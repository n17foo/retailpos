import { returnRepository, ReturnRow, CreateReturnInput } from '../../repositories/ReturnRepository';
import { orderRepository } from '../../repositories/OrderRepository';
import { OrderItemRepository } from '../../repositories/OrderItemRepository';
import { LoggerFactory } from '../logger/loggerFactory';
import { auditLogService } from '../audit/AuditLogService';
import { RefundServiceFactory } from '../refund/refundServiceFactory';
import { ECommercePlatform } from '../../utils/platforms';
import { notificationService } from '../notifications/NotificationService';

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

/**
 * Service for processing returns and stock adjustments.
 * Returns are recorded locally and can optionally restock inventory.
 */
export class ReturnService {
  private static instance: ReturnService;
  private logger = LoggerFactory.getInstance().createLogger('ReturnService');
  private orderItemRepo = new OrderItemRepository();

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
          const refundService = RefundServiceFactory.getInstance().getRefundServiceForPlatform(platform ?? undefined);
          const refundResult = await refundService.processEcommerceRefund(order.platform_order_id || input.orderId, {
            amount: Math.round(totalRefund * 100) / 100,
            reason: input.items[0]?.reason ?? 'POS return',
            items: input.items.map(i => ({
              lineItemId: i.orderItemId || i.productId,
              quantity: i.quantity,
              amount: i.refundAmount,
              restockInventory: i.restock,
            })),
          });
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
}

export const returnService = ReturnService.getInstance();
