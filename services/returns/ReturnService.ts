import { returnRepository, ReturnRow, CreateReturnInput } from '../../repositories/ReturnRepository';
import { orderRepository } from '../../repositories/OrderRepository';
import { OrderItemRepository } from '../../repositories/OrderItemRepository';
import { LoggerFactory } from '../logger/LoggerFactory';
import { auditLogService } from '../audit/AuditLogService';
import { ECommercePlatform } from '../../utils/platforms';
import { notificationService } from '../notifications/NotificationService';
import { PlatformRefundServiceInterface } from '../returns/platforms/PlatformRefundServiceInterface';
import { ShopifyRefundService } from '../returns/platforms/shopifyRefundService';
import { WooCommerceRefundService } from '../returns/platforms/wooCommerceRefundService';
import { MagentoRefundService } from '../returns/platforms/magentoRefundService';
import { BigCommerceRefundService } from '../returns/platforms/bigCommerceRefundService';
import { SyliusRefundService } from '../returns/platforms/syliusRefundService';
import { WixRefundService } from '../returns/platforms/wixRefundService';
import { PrestaShopRefundService } from '../returns/platforms/PrestaShopRefundService';
import { SquarespaceRefundService } from '../returns/platforms/SquarespaceRefundService';
import { CommerceFullRefundService } from '../returns/platforms/CommerceFullRefundService';
import { OfflineRefundService } from '../returns/platforms/OfflineRefundService';

export interface ReturnItem {
  id: string;
  orderId: string;
  orderItemId: string | null;
  productId: string;
  variantId: string | null;
  productName: string;
  quantity: number;
  refundAmount: number;
  reason: string | null;
  restock: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  processedBy: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: ReturnRow): ReturnItem {
  return {
    id: row.id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    productId: row.product_id,
    variantId: row.variant_id,
    productName: row.product_name,
    quantity: row.quantity,
    refundAmount: row.refund_amount,
    reason: row.reason,
    restock: row.restock === 1,
    status: row.status as ReturnItem['status'],
    processedBy: row.processed_by,
    processedAt: row.processed_at ? new Date(row.processed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export interface ProcessReturnInput {
  orderId: string;
  items: {
    orderItemId?: string;
    productId: string;
    variantId?: string;
    productName: string;
    quantity: number;
    refundAmount: number;
    reason?: string;
    restock?: boolean;
  }[];
  processedBy?: string;
  /** If set, also trigger a monetary refund via the platform refund service */
  issueRefund?: boolean;
  /** Platform for the refund (read from order if not provided) */
  platform?: ECommercePlatform;
}

export interface ProcessReturnResult {
  success: boolean;
  returnIds: string[];
  totalRefund: number;
  /** Platform refund ID if a monetary refund was issued */
  refundId?: string;
  error?: string;
}

// ── Refund types (unified into ReturnService) ──────────────────────────────

export interface RefundData {
  items?: Array<{
    lineItemId: string;
    quantity: number;
    amount?: number;
    restockInventory?: boolean;
  }>;
  amount?: number;
  reason?: string;
  note?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  error?: string;
  timestamp: Date;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  transactionId?: string;
  amount: number;
  items?: Array<{
    lineItemId: string;
    quantity: number;
    amount: number;
  }>;
  reason?: string;
  note?: string;
  status: 'pending' | 'completed' | 'failed';
  source: 'ecommerce' | 'payment_terminal';
  timestamp: Date;
}

/**
 * Unified service for processing returns and refunds.
 * Returns are recorded locally and can optionally trigger platform refunds.
 * Refunds can also be processed independently (e.g. payment terminal refunds).
 */
export class ReturnService {
  private static instance: ReturnService;
  private logger = LoggerFactory.getInstance().createLogger('ReturnService');
  private orderItemRepo = new OrderItemRepository();
  private platformRefundServices: Map<ECommercePlatform, PlatformRefundServiceInterface> = new Map();
  private offlineRefundService: OfflineRefundService | null = null;
  private refundInitialized = false;

  private constructor() {}

  static getInstance(): ReturnService {
    if (!ReturnService.instance) {
      ReturnService.instance = new ReturnService();
    }
    return ReturnService.instance;
  }

  /** Process a return for one or more items from an order */
  async processReturn(input: ProcessReturnInput): Promise<ProcessReturnResult> {
    try {
      // Validate the order exists and is paid/synced
      const order = await orderRepository.findById(input.orderId);
      if (!order) {
        return { success: false, returnIds: [], totalRefund: 0, error: 'Order not found' };
      }
      if (order.status !== 'paid' && order.status !== 'synced') {
        return { success: false, returnIds: [], totalRefund: 0, error: 'Order must be paid before processing a return' };
      }

      const returnIds: string[] = [];
      let totalRefund = 0;

      for (const item of input.items) {
        const returnInput: CreateReturnInput = {
          orderId: input.orderId,
          orderItemId: item.orderItemId ?? null,
          productId: item.productId,
          variantId: item.variantId ?? null,
          productName: item.productName,
          quantity: item.quantity,
          refundAmount: item.refundAmount,
          reason: item.reason ?? null,
          restock: item.restock,
        };

        const id = await returnRepository.create(returnInput);
        // Auto-approve and complete for POS returns
        await returnRepository.updateStatus(id, 'completed', input.processedBy);
        returnIds.push(id);
        totalRefund += item.refundAmount;
      }

      this.logger.info(`Processed return for order ${input.orderId}: ${returnIds.length} item(s), refund ${totalRefund.toFixed(2)}`);

      // Optionally trigger a monetary refund via the platform refund service
      let refundId: string | undefined;
      if (input.issueRefund) {
        const platform = input.platform ?? (order.platform as ECommercePlatform | undefined);
        try {
          const refundResult = await this.processRefund(
            order.platform_order_id || input.orderId,
            {
              amount: Math.round(totalRefund * 100) / 100,
              reason: input.items[0]?.reason ?? 'POS return',
              items: input.items.map(i => ({
                lineItemId: i.orderItemId || i.productId,
                quantity: i.quantity,
                amount: i.refundAmount,
                restockInventory: i.restock,
              })),
            },
            platform ?? undefined
          );
          if (refundResult.success) {
            refundId = refundResult.refundId;
            this.logger.info(`Platform refund issued: ${refundId}`);
          } else {
            this.logger.warn(`Platform refund failed: ${refundResult.error}`);
            notificationService.notify('Refund Warning', `Return recorded but platform refund failed: ${refundResult.error}`, 'warning');
          }
        } catch (refundError) {
          this.logger.warn(`Platform refund error: ${refundError instanceof Error ? refundError.message : String(refundError)}`);
        }
      }

      auditLogService.log('return:created', {
        userId: input.processedBy,
        details: `Return for order ${input.orderId}: ${returnIds.length} item(s), refund ${totalRefund.toFixed(2)}${refundId ? `, platform refund ${refundId}` : ''}`,
        metadata: { orderId: input.orderId, returnIds, totalRefund, refundId },
      });

      notificationService.notify('Return Processed', `${returnIds.length} item(s) returned for order ${input.orderId.slice(-8)}`, 'info');

      return {
        success: true,
        returnIds,
        totalRefund: Math.round(totalRefund * 100) / 100,
        refundId,
      };
    } catch (error) {
      this.logger.error(
        { message: `Failed to process return for order ${input.orderId}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return { success: false, returnIds: [], totalRefund: 0, error: 'Failed to process return' };
    }
  }

  /** Get all returns for a specific order */
  async getReturnsByOrder(orderId: string): Promise<ReturnItem[]> {
    const rows = await returnRepository.findByOrderId(orderId);
    return rows.map(mapRow);
  }

  /** Get all returns, optionally filtered by status */
  async getAllReturns(status?: ReturnItem['status']): Promise<ReturnItem[]> {
    const rows = await returnRepository.findAll(status);
    return rows.map(mapRow);
  }

  /** Get returns for a date range */
  async getReturnsByDateRange(from: number, to: number): Promise<ReturnItem[]> {
    const rows = await returnRepository.findByDateRange(from, to);
    return rows.map(mapRow);
  }

  /** Get a single return by ID */
  async getReturnById(id: string): Promise<ReturnItem | null> {
    const row = await returnRepository.findById(id);
    return row ? mapRow(row) : null;
  }

  /** Get returnable items for an order (items not yet fully returned) */
  async getReturnableItems(orderId: string): Promise<
    {
      orderItemId: string;
      productId: string;
      variantId: string | null;
      name: string;
      price: number;
      originalQuantity: number;
      returnedQuantity: number;
      returnableQuantity: number;
    }[]
  > {
    const orderItems = await this.orderItemRepo.findByOrderId(orderId);
    const existingReturns = await returnRepository.findByOrderId(orderId);

    // Sum up already-returned quantities per order item
    const returnedMap = new Map<string, number>();
    for (const ret of existingReturns) {
      if (ret.status === 'completed' || ret.status === 'approved') {
        const key = ret.order_item_id || ret.product_id;
        returnedMap.set(key, (returnedMap.get(key) || 0) + ret.quantity);
      }
    }

    return orderItems
      .map(item => {
        const key = item.id;
        const returnedQty = returnedMap.get(key) || 0;
        return {
          orderItemId: item.id,
          productId: item.product_id,
          variantId: item.variant_id,
          name: item.name,
          price: item.price,
          originalQuantity: item.quantity,
          returnedQuantity: returnedQty,
          returnableQuantity: Math.max(0, item.quantity - returnedQty),
        };
      })
      .filter(item => item.returnableQuantity > 0);
  }

  // ── Refund capabilities ──────────────────────────────────────────────────

  /**
   * Initialize the refund subsystem.
   * Called lazily on first refund operation if not called explicitly.
   */
  async initializeRefundService(): Promise<boolean> {
    if (this.refundInitialized) return true;
    try {
      this.offlineRefundService = new OfflineRefundService();
      await this.offlineRefundService.initialize();
      this.refundInitialized = true;
      this.logger.info('Refund subsystem initialized');
      return true;
    } catch (error) {
      this.logger.error({ message: 'Failed to initialize refund subsystem' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get or create a platform-specific refund service.
   */
  private getPlatformRefundService(platform: ECommercePlatform): PlatformRefundServiceInterface {
    if (this.platformRefundServices.has(platform)) {
      return this.platformRefundServices.get(platform)!;
    }

    let service: PlatformRefundServiceInterface;
    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        service = new ShopifyRefundService();
        break;
      case ECommercePlatform.WOOCOMMERCE:
        service = new WooCommerceRefundService();
        break;
      case ECommercePlatform.MAGENTO:
        service = new MagentoRefundService();
        break;
      case ECommercePlatform.BIGCOMMERCE:
        service = new BigCommerceRefundService();
        break;
      case ECommercePlatform.SYLIUS:
        service = new SyliusRefundService();
        break;
      case ECommercePlatform.WIX:
        service = new WixRefundService();
        break;
      case ECommercePlatform.PRESTASHOP:
        service = new PrestaShopRefundService();
        break;
      case ECommercePlatform.SQUARESPACE:
        service = new SquarespaceRefundService();
        break;
      case ECommercePlatform.COMMERCEFULL:
        service = new CommerceFullRefundService();
        break;
      default:
        service = this.offlineRefundService ?? new OfflineRefundService();
        break;
    }

    this.platformRefundServices.set(platform, service);
    return service;
  }

  /**
   * Process a refund for an e-commerce order on the given platform.
   * If no platform is provided, falls back to offline/local refund.
   */
  async processRefund(orderId: string, refundData: RefundData, platform?: ECommercePlatform): Promise<RefundResult> {
    try {
      if (!this.refundInitialized) {
        await this.initializeRefundService();
      }

      const service = platform
        ? this.getPlatformRefundService(platform)
        : (this.offlineRefundService ?? this.getPlatformRefundService(ECommercePlatform.OFFLINE));

      if (!service.isInitialized()) {
        await service.initialize();
      }

      this.logger.info(`Processing refund for order ${orderId} via ${platform || 'offline'}`);
      return await service.processRefund(orderId, refundData);
    } catch (error) {
      this.logger.error(
        { message: `Error processing refund for order ${orderId}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Process a payment terminal refund (offline / local).
   */
  async processPaymentRefund(transactionId: string, amount: number, reason?: string): Promise<RefundResult> {
    try {
      if (!this.refundInitialized) {
        await this.initializeRefundService();
      }

      const service = this.offlineRefundService ?? new OfflineRefundService();
      if (!service.isInitialized()) {
        await service.initialize();
      }

      this.logger.info(`Processing payment refund for transaction ${transactionId}`);
      return await service.processRefund(transactionId, {
        amount,
        reason: reason || 'Payment terminal refund',
      });
    } catch (error) {
      this.logger.error(
        { message: `Error processing payment refund for transaction ${transactionId}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get refund history for an order.
   */
  async getRefundHistory(orderId: string, platform?: ECommercePlatform): Promise<RefundRecord[]> {
    try {
      if (!this.refundInitialized) {
        await this.initializeRefundService();
      }

      const service = platform
        ? this.getPlatformRefundService(platform)
        : (this.offlineRefundService ?? this.getPlatformRefundService(ECommercePlatform.OFFLINE));

      if (!service.isInitialized()) {
        await service.initialize();
      }

      return await service.getRefundHistory(orderId);
    } catch (error) {
      this.logger.error(
        { message: `Error getting refund history for order ${orderId}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * Configure a platform refund service (called by ServiceConfigBridge).
   */
  configurePlatformRefund(platform: ECommercePlatform, _config: Record<string, unknown>): void {
    this.getPlatformRefundService(platform);
    this.logger.info(`Refund service configured for ${platform}`);
  }
}

export const returnService = ReturnService.getInstance();
