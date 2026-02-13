import { ECommercePlatform } from '../../utils/platforms';
import { BasketItem } from '../basket/basket';
import { LocalOrder, LocalOrderStatus, CheckoutResult } from '../order/order';
import { BasketServiceInterface } from '../basket/BasketServiceInterface';
import { CheckoutServiceInterface } from './CheckoutServiceInterface';
import { OrderRepository, OrderRow } from '../../repositories/OrderRepository';
import { OrderItemRepository } from '../../repositories/OrderItemRepository';
import { LoggerInterface } from '../logger/LoggerInterface';
import { posConfig } from '../config/POSConfigService';
import { generateUUID } from '../../utils/uuid';

/**
 * Handles checkout flow and order queries.
 * Depends on BasketService for reading/clearing the basket.
 */
export class CheckoutService implements CheckoutServiceInterface {
  constructor(
    private basketService: BasketServiceInterface,
    private orderRepo: OrderRepository,
    private orderItemRepo: OrderItemRepository,
    private logger: LoggerInterface
  ) {}

  async startCheckout(platform?: ECommercePlatform, cashierId?: string, cashierName?: string): Promise<LocalOrder> {
    const basket = await this.basketService.getBasket();

    if (basket.items.length === 0) {
      throw new Error('Cannot checkout with empty basket');
    }

    const now = Date.now();
    const orderId = generateUUID();

    const localOrder: LocalOrder = {
      id: orderId,
      platform,
      items: [...basket.items],
      subtotal: basket.subtotal,
      tax: basket.tax,
      total: basket.total,
      discountAmount: basket.discountAmount,
      discountCode: basket.discountCode,
      customerEmail: basket.customerEmail,
      customerName: basket.customerName,
      note: basket.note,
      cashierId,
      cashierName,
      status: 'pending',
      syncStatus: 'pending',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    // Save order
    await this.orderRepo.create({
      id: orderId,
      platform: platform ?? null,
      subtotal: basket.subtotal,
      tax: basket.tax,
      total: basket.total,
      discountAmount: basket.discountAmount ?? null,
      discountCode: basket.discountCode ?? null,
      customerEmail: basket.customerEmail ?? null,
      customerName: basket.customerName ?? null,
      note: basket.note ?? null,
      cashierId: cashierId ?? null,
      cashierName: cashierName ?? null,
    });

    // Save order items
    await this.orderItemRepo.createMany(
      basket.items.map(item => ({
        orderId,
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        taxable: item.taxable,
        taxRate: item.taxRate,
        isEcommerceProduct: item.isEcommerceProduct,
        originalId: item.originalId,
        properties: item.properties,
      }))
    );

    return localOrder;
  }

  async markPaymentProcessing(orderId: string): Promise<LocalOrder> {
    await this.orderRepo.updateStatus(orderId, 'processing');

    const order = await this.getLocalOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    return order;
  }

  async completePayment(orderId: string, paymentMethod: string, transactionId?: string): Promise<CheckoutResult> {
    try {
      await this.orderRepo.updatePayment(orderId, paymentMethod, transactionId ?? null);

      // Clear basket and prepare for next transaction
      await this.basketService.clearBasket();

      // Signal the UI to open the drawer when paying with cash
      const isCash = paymentMethod.toLowerCase() === 'cash';
      const openDrawer = isCash && posConfig.values.drawerOpenOnCash;

      return { success: true, orderId, openDrawer };
    } catch (error) {
      this.logger.error({ message: `Failed to complete payment for order ${orderId}` }, error as Error);

      await this.orderRepo.updateStatus(orderId, 'failed');

      return { success: false, orderId, error: (error as Error).message };
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.orderRepo.updateStatus(orderId, 'cancelled');
  }

  // ── Order queries ───────────────────────────────────────────────────

  async getLocalOrders(status?: LocalOrderStatus): Promise<LocalOrder[]> {
    const rows = await this.orderRepo.findAll(status);
    return Promise.all(rows.map(row => this.mapOrderRowToLocalOrder(row)));
  }

  async getUnsyncedOrders(): Promise<LocalOrder[]> {
    const rows = await this.orderRepo.findUnsynced();
    return Promise.all(rows.map(row => this.mapOrderRowToLocalOrder(row)));
  }

  async getLocalOrder(orderId: string): Promise<LocalOrder | null> {
    const row = await this.orderRepo.findById(orderId);
    if (!row) return null;
    return this.mapOrderRowToLocalOrder(row);
  }

  // ── Mapping ─────────────────────────────────────────────────────────

  private async mapOrderRowToLocalOrder(row: OrderRow): Promise<LocalOrder> {
    const itemRows = await this.orderItemRepo.findByOrderId(row.id);
    const items: BasketItem[] = itemRows.map(ir => ({
      id: ir.id,
      productId: ir.product_id,
      variantId: ir.variant_id ?? undefined,
      sku: ir.sku ?? undefined,
      name: ir.name,
      price: ir.price,
      quantity: ir.quantity,
      image: ir.image ?? undefined,
      taxable: ir.taxable === 1,
      taxRate: ir.tax_rate ?? undefined,
      isEcommerceProduct: ir.is_ecommerce_product === 1,
      originalId: ir.original_id ?? undefined,
      properties: ir.properties ? JSON.parse(ir.properties) : undefined,
    }));

    return {
      id: row.id,
      platformOrderId: row.platform_order_id ?? undefined,
      platform: row.platform as ECommercePlatform | undefined,
      items,
      subtotal: row.subtotal,
      tax: row.tax,
      total: row.total,
      discountAmount: row.discount_amount ?? undefined,
      discountCode: row.discount_code ?? undefined,
      cashierId: row.cashier_id ?? undefined,
      cashierName: row.cashier_name ?? undefined,
      customerEmail: row.customer_email ?? undefined,
      customerName: row.customer_name ?? undefined,
      note: row.note ?? undefined,
      paymentMethod: row.payment_method ?? undefined,
      paymentTransactionId: row.payment_transaction_id ?? undefined,
      status: row.status as LocalOrderStatus,
      syncStatus: row.sync_status as 'pending' | 'synced' | 'failed',
      syncError: row.sync_error ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
      syncedAt: row.synced_at ? new Date(row.synced_at) : undefined,
    };
  }
}
