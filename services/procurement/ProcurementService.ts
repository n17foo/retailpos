/**
 * ProcurementService
 *
 * Manages purchase orders, receiving, reorder points, and vendor returns.
 * Pushes stock adjustments to the platform via InventoryServiceFactory on receiving.
 *
 * See: docs/specs/inventory/inventory.md §7.2–7.3, §7.7
 */

import {
  procurementRepository,
  CreatePOInput,
  PurchaseOrderRow,
  PurchaseOrderItemRow,
  ProductInventoryConfigRow,
  VendorReturnRow,
  VendorReturnItemRow,
} from '../../repositories/ProcurementRepository';
import { InventoryServiceFactory } from '../inventory/InventoryServiceFactory';
import { auditLogService } from '../audit/AuditLogService';
import { notificationService } from '../notifications/NotificationService';
import { LoggerFactory } from '../logger/LoggerFactory';
import { ECommercePlatform } from '../../utils/platforms';
import { getPlatformCapabilities } from '../../utils/platformCapabilities';

export interface ReceiveLineInput {
  itemId: string;
  receiveNow: number;
}

export interface ReceiveResult {
  success: boolean;
  newStatus: 'partially_received' | 'received';
  error?: string;
}

export class ProcurementService {
  private static instance: ProcurementService;
  private logger = LoggerFactory.getInstance().createLogger('ProcurementService');

  private constructor() {}

  static getInstance(): ProcurementService {
    if (!ProcurementService.instance) {
      ProcurementService.instance = new ProcurementService();
    }
    return ProcurementService.instance;
  }

  // ── Purchase Orders ───────────────────────────────────────────────────

  async createPO(input: CreatePOInput): Promise<string> {
    const id = await procurementRepository.createPO(input);
    await auditLogService.log('purchase_order:created', {
      userId: input.createdBy ?? undefined,
      details: `Purchase order ${id} created (${input.items.length} line(s))`,
      metadata: { poId: id, vendorId: input.vendorId, itemCount: input.items.length },
    });
    return id;
  }

  async submitPO(poId: string, submittedBy?: string): Promise<void> {
    const now = Date.now();
    await procurementRepository.updatePOStatus(poId, 'ordered', now);
    await auditLogService.log('purchase_order:submitted', {
      userId: submittedBy,
      details: `Purchase order ${poId} submitted`,
      metadata: { poId },
    });
  }

  async cancelPO(poId: string, cancelledBy?: string): Promise<void> {
    const po = await procurementRepository.findPOById(poId);
    if (!po || (po.status !== 'draft' && po.status !== 'ordered')) {
      throw new Error('Only draft or ordered purchase orders can be cancelled');
    }
    await procurementRepository.updatePOStatus(poId, 'cancelled');
    await auditLogService.log('purchase_order:cancelled', {
      userId: cancelledBy,
      details: `Purchase order ${poId} cancelled`,
      metadata: { poId },
    });
  }

  async findAllPOs(status?: PurchaseOrderRow['status']): Promise<PurchaseOrderRow[]> {
    return procurementRepository.findAllPOs(status);
  }

  async findPOById(id: string): Promise<PurchaseOrderRow | null> {
    return procurementRepository.findPOById(id);
  }

  async findPOItems(poId: string): Promise<PurchaseOrderItemRow[]> {
    return procurementRepository.findPOItems(poId);
  }

  /**
   * Receive goods against a purchase order.
   * Increments received quantities and pushes stock adjustments to the platform.
   */
  async receivePO(poId: string, lines: ReceiveLineInput[], platform: ECommercePlatform, receivedBy?: string): Promise<ReceiveResult> {
    try {
      const items = await procurementRepository.findPOItems(poId);

      // Increment received quantities
      for (const line of lines) {
        if (line.receiveNow <= 0) continue;
        await procurementRepository.incrementReceivedQty(line.itemId, line.receiveNow);
      }

      // Push stock adjustments to platform (gated on inventory capability)
      const capabilities = getPlatformCapabilities(platform);
      if (capabilities.inventory !== 'not_recommended') {
        const inventoryService = InventoryServiceFactory.getInstance().getService(platform);
        const updates = lines
          .filter(l => l.receiveNow > 0)
          .map(line => {
            const item = items.find(i => i.id === line.itemId);
            return item
              ? { productId: item.product_id, variantId: item.variant_id ?? undefined, quantity: line.receiveNow, adjustment: true }
              : null;
          })
          .filter((u): u is NonNullable<typeof u> => u !== null);

        if (updates.length > 0) {
          await inventoryService.updateInventory(updates).catch(err => {
            this.logger.warn({ message: `Inventory push failed for PO ${poId}: ${err instanceof Error ? err.message : String(err)}` });
          });
        }
      }

      // Determine new PO status
      const updatedItems = await procurementRepository.findPOItems(poId);
      const allReceived = updatedItems.every(i => i.received_qty >= i.ordered_qty);
      const newStatus = allReceived ? 'received' : 'partially_received';
      await procurementRepository.updatePOStatus(poId, newStatus);

      await auditLogService.log('purchase_order:received', {
        userId: receivedBy,
        details: `Purchase order ${poId} receiving: ${lines.length} line(s) — status: ${newStatus}`,
        metadata: { poId, newStatus, lines },
      });

      if (newStatus === 'received') {
        notificationService.notify('Purchase Order Received', `PO ${poId.slice(-8)} fully received`, 'info');
      }

      return { success: true, newStatus };
    } catch (err) {
      this.logger.error({ message: `Failed to receive PO ${poId}` }, err instanceof Error ? err : new Error(String(err)));
      return { success: false, newStatus: 'partially_received', error: err instanceof Error ? err.message : 'Receiving failed' };
    }
  }

  // ── Reorder Points ────────────────────────────────────────────────────

  async setReorderPoint(
    productId: string,
    variantId: string | null,
    reorderPoint: number,
    reorderQty: number,
    defaultVendorId?: string | null
  ): Promise<void> {
    await procurementRepository.upsertInventoryConfig(productId, variantId, reorderPoint, reorderQty, defaultVendorId);
  }

  async getReorderConfig(productId: string, variantId?: string | null): Promise<ProductInventoryConfigRow | null> {
    return procurementRepository.findInventoryConfig(productId, variantId);
  }

  async getAllReorderConfigs(): Promise<ProductInventoryConfigRow[]> {
    return procurementRepository.findAllInventoryConfigs();
  }

  /**
   * Check if a product has breached its reorder point and notify if so.
   * Called after inventory adjustments (e.g. post-sale).
   */
  async checkReorderPoint(productId: string, variantId: string | null, currentQty: number, productName: string): Promise<void> {
    const config = await procurementRepository.findInventoryConfig(productId, variantId);
    if (!config || config.reorder_point <= 0) return;
    if (currentQty <= config.reorder_point) {
      notificationService.notify('Reorder Required', `${productName} is at or below reorder point (${currentQty} remaining)`, 'warning');
    }
  }

  // ── Vendor Returns ────────────────────────────────────────────────────

  async createVendorReturn(input: {
    purchaseOrderId: string;
    vendorId: string;
    notes: string | null;
    createdBy: string | null;
    items: Array<{ productId: string; variantId?: string | null; productName: string; returnQty: number; reason?: string | null }>;
  }): Promise<string> {
    const id = await procurementRepository.createVendorReturn(
      input.purchaseOrderId,
      input.vendorId,
      input.notes,
      input.createdBy,
      input.items
    );
    await auditLogService.log('vendor_return:created', {
      userId: input.createdBy ?? undefined,
      details: `Vendor return ${id} created against PO ${input.purchaseOrderId}`,
      metadata: { returnId: id, purchaseOrderId: input.purchaseOrderId, vendorId: input.vendorId },
    });
    return id;
  }

  async confirmVendorReturn(returnId: string, platform: ECommercePlatform, confirmedBy?: string): Promise<void> {
    const items = await procurementRepository.findVendorReturnItems(returnId);

    // Decrement inventory for each returned line
    const capabilities = getPlatformCapabilities(platform);
    if (capabilities.inventory !== 'not_recommended') {
      const inventoryService = InventoryServiceFactory.getInstance().getService(platform);
      const updates = items.map(item => ({
        productId: item.product_id,
        variantId: item.variant_id ?? undefined,
        quantity: -item.return_qty,
        adjustment: true,
      }));
      if (updates.length > 0) {
        await inventoryService.updateInventory(updates).catch(err => {
          this.logger.warn({
            message: `Inventory decrement failed for vendor return ${returnId}: ${err instanceof Error ? err.message : String(err)}`,
          });
        });
      }
    }

    await procurementRepository.updateVendorReturnStatus(returnId, 'confirmed');
    await auditLogService.log('vendor_return:confirmed', {
      userId: confirmedBy,
      details: `Vendor return ${returnId} confirmed — ${items.length} line(s)`,
      metadata: { returnId },
    });
  }

  async findAllVendorReturns(status?: 'pending' | 'confirmed' | 'cancelled'): Promise<VendorReturnRow[]> {
    return procurementRepository.findAllVendorReturns(status);
  }

  async findVendorReturnItems(returnId: string): Promise<VendorReturnItemRow[]> {
    return procurementRepository.findVendorReturnItems(returnId);
  }

  async cancelVendorReturn(returnId: string, cancelledBy?: string): Promise<void> {
    await procurementRepository.updateVendorReturnStatus(returnId, 'cancelled');
    await auditLogService.log('vendor_return:cancelled', {
      userId: cancelledBy,
      details: `Vendor return ${returnId} cancelled`,
      metadata: { returnId },
    });
  }

  // ── Transfer Orders ───────────────────────────────────────────────────

  /**
   * Dispatch a transfer order (draft → in_transit).
   * Decrements inventory at fromLocation.
   * Spec §7.5.2
   */
  async dispatchTransferOrder(transferOrderId: string, platform: ECommercePlatform, dispatchedBy?: string): Promise<void> {
    const items = await procurementRepository.findTransferOrderItems(transferOrderId);
    const capabilities = getPlatformCapabilities(platform);

    if (capabilities.inventory !== 'not_recommended') {
      const inventoryService = InventoryServiceFactory.getInstance().getService(platform);
      const updates = items.map(item => ({
        productId: item.product_id,
        variantId: item.variant_id ?? undefined,
        quantity: -item.transfer_qty,
        adjustment: true,
      }));
      if (updates.length > 0) {
        await inventoryService.updateInventory(updates).catch(err => {
          this.logger.warn({
            message: `Inventory decrement failed for transfer ${transferOrderId}: ${err instanceof Error ? err.message : String(err)}`,
          });
        });
      }
    }

    await procurementRepository.updateTransferOrderStatus(transferOrderId, 'in_transit');
    await auditLogService.log('transfer_order:dispatched', {
      userId: dispatchedBy,
      details: `Transfer order ${transferOrderId} dispatched`,
      metadata: { transferOrderId },
    });
  }

  /**
   * Confirm receipt of a transfer order (in_transit → received).
   * Increments inventory at toLocation.
   * Spec §7.5.3
   */
  async receiveTransferOrder(transferOrderId: string, platform: ECommercePlatform, receivedBy?: string): Promise<void> {
    const items = await procurementRepository.findTransferOrderItems(transferOrderId);
    const capabilities = getPlatformCapabilities(platform);

    if (capabilities.inventory !== 'not_recommended') {
      const inventoryService = InventoryServiceFactory.getInstance().getService(platform);
      const updates = items.map(item => ({
        productId: item.product_id,
        variantId: item.variant_id ?? undefined,
        quantity: item.transfer_qty,
        adjustment: true,
      }));
      if (updates.length > 0) {
        await inventoryService.updateInventory(updates).catch(err => {
          this.logger.warn({
            message: `Inventory increment failed for transfer ${transferOrderId}: ${err instanceof Error ? err.message : String(err)}`,
          });
        });
      }
    }

    await procurementRepository.updateTransferOrderStatus(transferOrderId, 'received');
    await auditLogService.log('transfer_order:received', {
      userId: receivedBy,
      details: `Transfer order ${transferOrderId} received`,
      metadata: { transferOrderId },
    });
  }

  async findAllTransferOrders(status?: import('../../repositories/ProcurementRepository').TransferStatus) {
    return procurementRepository.findAllTransferOrders(status);
  }

  async findTransferOrderById(id: string) {
    return procurementRepository.findTransferOrderById(id);
  }

  async findTransferOrderItems(transferOrderId: string) {
    return procurementRepository.findTransferOrderItems(transferOrderId);
  }

  async cancelTransferOrder(transferOrderId: string, cancelledBy?: string): Promise<void> {
    await procurementRepository.updateTransferOrderStatus(transferOrderId, 'cancelled');
    await auditLogService.log('transfer_order:cancelled', {
      userId: cancelledBy,
      details: `Transfer order ${transferOrderId} cancelled`,
      metadata: { transferOrderId },
    });
  }

  async createTransferOrder(input: {
    fromLocation: string;
    toLocation: string;
    notes: string | null;
    createdBy: string | null;
    items: Array<{ productId: string; variantId?: string | null; productName: string; transferQty: number }>;
  }): Promise<string> {
    const id = await procurementRepository.createTransferOrder(
      input.fromLocation,
      input.toLocation,
      input.notes,
      input.createdBy,
      input.items
    );
    await auditLogService.log('transfer_order:created', {
      userId: input.createdBy ?? undefined,
      details: `Transfer order ${id} created`,
      metadata: { transferOrderId: id, fromLocation: input.fromLocation, toLocation: input.toLocation },
    });
    return id;
  }
}

export const procurementService = ProcurementService.getInstance();
