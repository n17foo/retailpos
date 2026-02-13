import { OrderServiceFactory } from '../order/orderServiceFactory';
import { Order, OrderLineItem } from '../order/OrderServiceInterface';
import { BasketItem } from '../basket/basket';
import { CheckoutResult, SyncResult } from '../order/order';
import { CheckoutServiceInterface } from '../checkout/CheckoutServiceInterface';
import { OrderSyncServiceInterface } from './OrderSyncServiceInterface';
import { OrderRepository } from '../../repositories/OrderRepository';
import { LoggerInterface } from '../logger/LoggerInterface';
import { DEFAULT_TAX_RATE, MAX_SYNC_RETRIES } from '../config/POSConfigService';
import { calculateLineTotal } from '../../utils/money';

/**
 * Handles syncing paid orders to e-commerce platforms.
 * Depends on CheckoutService for order queries.
 */
export class OrderSyncService implements OrderSyncServiceInterface {
  /** Tracks retry attempts per order (in-memory, resets on app restart) */
  private retryCounts = new Map<string, number>();

  constructor(
    private checkoutService: CheckoutServiceInterface,
    private orderRepo: OrderRepository,
    private orderServiceFactory: OrderServiceFactory,
    private logger: LoggerInterface
  ) {}

  async syncOrderToPlatform(orderId: string): Promise<CheckoutResult> {
    const localOrder = await this.checkoutService.getLocalOrder(orderId);

    if (!localOrder) {
      return { success: false, orderId, error: 'Order not found' };
    }

    if (localOrder.status !== 'paid') {
      return { success: false, orderId, error: 'Order must be paid before syncing' };
    }

    if (localOrder.syncStatus === 'synced') {
      return { success: true, orderId, platformOrderId: localOrder.platformOrderId };
    }

    try {
      const orderService = this.orderServiceFactory.getService(localOrder.platform);

      const platformOrder: Order = {
        customerEmail: localOrder.customerEmail,
        customerName: localOrder.customerName,
        lineItems: this.basketItemsToLineItems(localOrder.items),
        subtotal: localOrder.subtotal,
        tax: localOrder.tax,
        total: localOrder.total,
        discounts: localOrder.discountCode
          ? [{ code: localOrder.discountCode, amount: localOrder.discountAmount ?? 0, type: 'fixed_amount' }]
          : undefined,
        paymentStatus: 'paid',
        note: localOrder.note,
        createdAt: localOrder.createdAt,
      };

      const createdOrder = await orderService.createOrder(platformOrder);
      await this.orderRepo.updateSyncSuccess(orderId, createdOrder.id ?? createdOrder.platformOrderId);

      return {
        success: true,
        orderId,
        platformOrderId: createdOrder.id ?? createdOrder.platformOrderId,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error({ message: `Failed to sync order ${orderId} to platform` }, error as Error);

      const retries = (this.retryCounts.get(orderId) ?? 0) + 1;
      this.retryCounts.set(orderId, retries);

      if (this.isRetryable(error) && retries < MAX_SYNC_RETRIES()) {
        await this.orderRepo.updateSyncError(orderId, 'pending', errorMessage);
        this.logger.info(`Order ${orderId} queued for retry (${retries}/${MAX_SYNC_RETRIES()})`);
        return { success: false, orderId, error: `Order queued for retry (${retries}/${MAX_SYNC_RETRIES()}): ${errorMessage}` };
      } else {
        await this.orderRepo.updateSyncError(orderId, 'failed', errorMessage);
        this.retryCounts.delete(orderId);
        return { success: false, orderId, error: errorMessage };
      }
    }
  }

  async syncAllPendingOrders(): Promise<SyncResult> {
    const unsyncedOrders = await this.checkoutService.getUnsyncedOrders();

    const result: SyncResult = { synced: 0, failed: 0, errors: [] };

    for (const order of unsyncedOrders) {
      const syncResult = await this.syncOrderToPlatform(order.id);

      if (syncResult.success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push({ orderId: order.id, error: syncResult.error ?? 'Unknown error' });
      }
    }

    return result;
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) return true;
      const statusMatch = error.message.match(/status (\d+)/);
      if (statusMatch) return parseInt(statusMatch[1], 10) >= 500;
    }
    return true;
  }

  private basketItemsToLineItems(items: BasketItem[]): OrderLineItem[] {
    return items.map(item => {
      const rate = item.taxRate ?? DEFAULT_TAX_RATE();
      const { lineTotal, taxAmount } = calculateLineTotal(item.price, item.quantity, item.taxable, rate);
      return {
        productId: item.originalId ?? item.productId,
        variantId: item.variantId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        taxable: item.taxable,
        taxRate: rate,
        taxAmount,
        total: lineTotal,
        properties: item.properties,
      };
    });
  }
}
