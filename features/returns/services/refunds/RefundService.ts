import { ReturnRepository, getReturnRepository, ReturnRow, CreateReturnInput } from '../../repositories/ReturnRepository';
import { getOrderRepository } from '../../../orders-sync/repositories/OrderRepository';
import { OrderItemRepository, getOrderItemRepository } from '../../../orders-sync/repositories/OrderItemRepository';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { auditLogService } from '../../../../shared/services/audit/AuditLogService';
import { ECommercePlatform } from '../../../../shared/utils/platforms';
import { notificationService } from '../../../../shared/services/notifications/NotificationService';
import { PlatformRefundServiceInterface } from './platforms/PlatformRefundServiceInterface';
import { ShopifyRefundService } from './platforms/shopifyRefundService';
import { WooCommerceRefundService } from './platforms/wooCommerceRefundService';
import { MagentoRefundService } from './platforms/magentoRefundService';
import { BigCommerceRefundService } from './platforms/bigCommerceRefundService';
import { SyliusRefundService } from './platforms/syliusRefundService';
import { WixRefundService } from './platforms/wixRefundService';
import { PrestaShopRefundService } from './platforms/PrestaShopRefundService';
import { CommercefullRefundService } from './platforms/CommercefullRefundService';
import { OfflineRefundService } from './platforms/OfflineRefundService';
import { COUNTED_RETURN_STATUSES, computeLineRefundable, validateReturnRequest } from './returnValidation';
import { addMoney, sumMoney, toCents } from '../../../../shared/utils/money';
import { withKeyedLock } from '../../../../shared/utils/keyedLock';
import { posConfig } from '../../../platform-clients/services/config/POSConfigService';
import { getFiscalService } from '../../../fiscal/services/FiscalServiceFactory';
import paymentService from '../../../payments/services/PaymentService';
import type { PaymentLine } from '../../../orders-sync/services/order/order';
import type { OrderRow } from '../../../orders-sync/repositories/OrderRepository';

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
  // Resolved at call time — instoreApiConfig.load() runs after module eval,
  // so binding a repo here would latch the offline implementation on clients.
  private get orderItemRepo(): OrderItemRepository {
    return getOrderItemRepository();
  }
  private get returnRepo(): ReturnRepository {
    return getReturnRepository();
  }
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
      // Serialise per order: validation reads existing returns, so two
      // concurrent requests must not both pass against the same remaining
      // quantity before either writes (double-return race). On a LAN client
      // the server re-validates under the same lock inside its POST route.
      const settled = await withKeyedLock(`return:${input.orderId}`, async () => {
        // Validate the order exists and is paid/synced
        const order = await getOrderRepository().findById(input.orderId);
        if (!order) {
          return { error: 'Order not found' };
        }
        const [orderItems, existingReturns] = await Promise.all([
          this.orderItemRepo.findByOrderId(input.orderId),
          this.returnRepo.findByOrderId(input.orderId),
        ]);
        const validationError = validateReturnRequest(input.items, {
          orderStatus: order.status,
          orderTotal: order.total,
          orderSubtotal: order.subtotal,
          orderDiscount: order.discount_amount,
          orderItems: orderItems ?? [],
          existingReturns: existingReturns ?? [],
        });
        if (validationError) {
          return { error: validationError };
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

          const id = await this.returnRepo.create(returnInput);
          await this.returnRepo.updateStatus(id, 'completed', input.processedBy);
          returnIds.push(id);
          totalRefund = addMoney(totalRefund, item.refundAmount);
        }

        return { order, returnIds, totalRefund };
      });

      if ('error' in settled) {
        return { success: false, returnIds: [], totalRefund: 0, error: settled.error };
      }
      const { order, returnIds, totalRefund } = settled;

      this.logger.info(`Processed return for order ${input.orderId}: ${returnIds.length} item(s), refund ${totalRefund.toFixed(2)}`);

      // Fiscal correction — one chained 'return' record per return row.
      // Best-effort like the platform refund: the return already happened,
      // a missing record is logged + audited for reissue (fiscal R6).
      if (posConfig.values.fiscalEnabled) {
        for (const returnId of returnIds) {
          try {
            const record = await getFiscalService().registerReturn(returnId, input.orderId);
            auditLogService.log('fiscal:return', {
              userId: input.processedBy,
              details: `Return ${returnId} chained as fiscal record ${record.number} for order ${input.orderId}`,
              metadata: { orderId: input.orderId, returnId, fiscalRecordId: record.id, number: record.number },
            });
          } catch (err) {
            this.logger.warn(
              { message: `Fiscal return record failed for ${returnId} — reissue required` },
              err instanceof Error ? err : new Error(String(err))
            );
          }
        }
      }

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
            platform ?? undefined,
            { forReturn: true }
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
    const rows = await this.returnRepo.findByOrderId(orderId);
    return rows.map(mapRow);
  }

  /** Get all returns, optionally filtered by status */
  async getAllReturns(status?: ReturnItem['status']): Promise<ReturnItem[]> {
    const rows = await this.returnRepo.findAll(status);
    return rows.map(mapRow);
  }

  /** Get returns for a date range */
  async getReturnsByDateRange(from: number, to: number): Promise<ReturnItem[]> {
    const rows = await this.returnRepo.findByDateRange(from, to);
    return rows.map(mapRow);
  }

  /** Get a single return by ID */
  async getReturnById(id: string): Promise<ReturnItem | null> {
    const row = await this.returnRepo.findById(id);
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
      /** Amount actually paid for the full returnableQuantity of this line (discount/tax allocated) */
      refundableAmount: number;
      originalQuantity: number;
      returnedQuantity: number;
      returnableQuantity: number;
    }[]
  > {
    const orderItems = await this.orderItemRepo.findByOrderId(orderId);
    const existingReturns = await this.returnRepo.findByOrderId(orderId);
    const order = await getOrderRepository().findById(orderId);

    // Sum up quantity-reserving returns per order item — pending returns hold
    // their quantity until rejected so the UI can't offer a double-return
    const returnedMap = new Map<string, number>();
    for (const ret of existingReturns) {
      if (COUNTED_RETURN_STATUSES.has(ret.status)) {
        const key = ret.order_item_id || ret.product_id;
        returnedMap.set(key, (returnedMap.get(key) || 0) + ret.quantity);
      }
    }

    return orderItems
      .map(item => {
        const key = item.id;
        const returnedQty = returnedMap.get(key) || 0;
        const returnableQuantity = Math.max(0, item.quantity - returnedQty);
        return {
          orderItemId: item.id,
          productId: item.product_id,
          variantId: item.variant_id,
          name: item.name,
          price: item.price,
          refundableAmount: computeLineRefundable(
            item,
            { subtotal: order?.subtotal ?? null, discount_amount: order?.discount_amount ?? null },
            returnableQuantity
          ),
          originalQuantity: item.quantity,
          returnedQuantity: returnedQty,
          returnableQuantity,
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
      case ECommercePlatform.COMMERCEFULL:
        service = new CommercefullRefundService();
        break;
      default:
        service = this.offlineRefundService ?? new OfflineRefundService();
        break;
    }

    this.platformRefundServices.set(platform, service);
    return service;
  }

  /**
   * Resolve a refund target to a real order — by local id first, then by
   * platform order id (the id a caller may know from the e-commerce side).
   */
  private async resolveOrderForRefund(orderId: string): Promise<OrderRow | null> {
    const repo = getOrderRepository();
    const direct = await repo.findById(orderId);
    if (direct) return direct;
    const all = await repo.findAll();
    return all.find(o => o.platform_order_id === orderId) ?? null;
  }

  /**
   * Resolve the order that a payment transaction belongs to — the primary
   * transaction id or any split-tender line recorded on the order.
   */
  private async resolveOrderByTransactionId(transactionId: string): Promise<OrderRow | null> {
    const all = await getOrderRepository().findAll();
    for (const order of all) {
      if (order.payment_transaction_id === transactionId) return order;
      if (order.payments_json) {
        try {
          const lines = JSON.parse(order.payments_json) as PaymentLine[];
          if (lines.some(line => line.transactionId === transactionId)) return order;
        } catch {
          this.logger.warn({ message: `Unreadable payments_json on order ${order.id} — skipped during refund lookup` });
        }
      }
    }
    return null;
  }

  /**
   * Remaining refundable credit on an order in cents: paid total minus prior
   * counted returns and prior recorded refunds. When `countReturns` is false
   * the refund is the monetary leg of already-recorded returns, so those
   * returns are not double-counted against the cap.
   */
  private async refundableBalanceCents(
    order: OrderRow,
    refundService: PlatformRefundServiceInterface,
    countReturns = true
  ): Promise<number> {
    const [returns, refundHistory] = await Promise.all([
      this.returnRepo.findByOrderId(order.id),
      refundService.getRefundHistory(order.id).catch(() => [] as RefundRecord[]),
    ]);
    const returnedCents = countReturns
      ? returns.filter(r => COUNTED_RETURN_STATUSES.has(r.status)).reduce((s, r) => s + toCents(r.refund_amount), 0)
      : 0;
    const refundedCents = refundHistory.filter(r => r.status !== 'failed').reduce((s, r) => s + toCents(r.amount), 0);
    return toCents(order.total) - returnedCents - refundedCents;
  }

  /**
   * Process a refund for an e-commerce order on the given platform.
   * If no platform is provided, falls back to offline/local refund.
   *
   * The refund must bind to a real paid order and fit within its remaining
   * refundable balance — free-form IDs and amounts are rejected (RET-04).
   */
  async processRefund(
    orderId: string,
    refundData: RefundData,
    platform?: ECommercePlatform,
    options?: { forReturn?: boolean }
  ): Promise<RefundResult> {
    try {
      if (!this.refundInitialized) {
        await this.initializeRefundService();
      }

      const order = await this.resolveOrderForRefund(orderId);
      if (!order) {
        return { success: false, error: 'Order not found — cannot refund an unknown order', timestamp: new Date() };
      }
      if (order.status !== 'paid' && order.status !== 'synced') {
        return { success: false, error: 'Order must be paid before it can be refunded', timestamp: new Date() };
      }
      const requested = refundData.amount ?? sumMoney((refundData.items ?? []).map(i => i.amount ?? 0));
      if (!Number.isFinite(requested) || requested <= 0) {
        return { success: false, error: 'Refund amount must be greater than zero', timestamp: new Date() };
      }

      const resolvedPlatform = platform ?? (order.platform as ECommercePlatform | null) ?? undefined;
      const service = resolvedPlatform
        ? this.getPlatformRefundService(resolvedPlatform)
        : (this.offlineRefundService ?? this.getPlatformRefundService(ECommercePlatform.OFFLINE));
      if (!service.isInitialized()) {
        await service.initialize();
      }

      // Serialise against returns on the same order — the balance check must
      // not race a concurrent return/refund reserving the same credit.
      return await withKeyedLock(`return:${order.id}`, async () => {
        const remainingCents = await this.refundableBalanceCents(order, service, !options?.forReturn);
        if (toCents(requested) > remainingCents) {
          return { success: false, error: 'Refund exceeds the remaining refundable amount for this order', timestamp: new Date() };
        }

        this.logger.info(`Processing refund for order ${order.id} via ${resolvedPlatform || 'offline'}`);
        const result = await service.processRefund(order.platform_order_id ?? order.id, refundData);

        if (result.success) {
          auditLogService.log('refund:processed', {
            details: `Refund of ${(result.amount ?? refundData.amount ?? 0).toFixed(2)} for order ${order.id} via ${resolvedPlatform || 'offline'}${refundData.reason ? ` — ${refundData.reason}` : ''}`,
            metadata: {
              orderId: order.id,
              refundId: result.refundId,
              amount: result.amount ?? refundData.amount,
              platform: resolvedPlatform,
            },
          });
        }

        return result;
      });
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
   * Process a payment terminal refund.
   *
   * The transaction must resolve to a real paid order and the amount must fit
   * its remaining refundable balance. The refund goes through the active
   * payment provider first; only a processor-confirmed refund is recorded
   * locally (RET-04).
   */
  async processPaymentRefund(transactionId: string, amount: number, reason?: string): Promise<RefundResult> {
    try {
      if (!this.refundInitialized) {
        await this.initializeRefundService();
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, error: 'Refund amount must be greater than zero', timestamp: new Date() };
      }
      const order = await this.resolveOrderByTransactionId(transactionId);
      if (!order) {
        return {
          success: false,
          error: 'Unknown transaction — cannot refund a payment that is not on record',
          timestamp: new Date(),
        };
      }
      if (order.status !== 'paid' && order.status !== 'synced') {
        return { success: false, error: 'Order must be paid before it can be refunded', timestamp: new Date() };
      }

      const service = this.offlineRefundService ?? new OfflineRefundService();
      if (!service.isInitialized()) {
        await service.initialize();
      }

      return await withKeyedLock(`return:${order.id}`, async () => {
        const remainingCents = await this.refundableBalanceCents(order, service);
        if (toCents(amount) > remainingCents) {
          return { success: false, error: 'Refund exceeds the remaining refundable amount for this order', timestamp: new Date() };
        }

        // Route through the real provider — recording a terminal refund
        // locally without processor confirmation leaves the customer
        // unrefunded while reporting success (RET-04).
        let providerResult;
        try {
          providerResult = await paymentService.refundTransaction(transactionId, amount);
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : 'The active payment provider does not support refunds',
            timestamp: new Date(),
          };
        }
        if (!providerResult.success) {
          return {
            success: false,
            error: providerResult.errorMessage ?? 'The payment provider declined the refund',
            timestamp: new Date(),
          };
        }

        this.logger.info(`Provider confirmed refund for transaction ${transactionId} — recording locally`);
        const result = await service.processRefund(
          transactionId,
          {
            amount,
            reason: reason || 'Payment terminal refund',
          },
          'payment_terminal'
        );

        if (result.success) {
          auditLogService.log('refund:processed', {
            details: `Payment refund of ${amount.toFixed(2)} for transaction ${transactionId}${reason ? ` — ${reason}` : ''}`,
            metadata: { orderId: order.id, transactionId, refundId: result.refundId, amount },
          });
        }

        return result;
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
