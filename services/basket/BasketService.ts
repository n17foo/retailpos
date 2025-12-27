import { SQLiteStorageService } from '../storage/SQLiteStorageService';
import { OrderServiceFactory } from '../order/orderServiceFactory';
import { Order, OrderLineItem } from '../order/OrderServiceInterface';
import { LoggerFactory } from '../logger';
import { ECommercePlatform } from '../../utils/platforms';
import {
  BasketServiceInterface,
  Basket,
  BasketItem,
  LocalOrder,
  LocalOrderStatus,
  CheckoutResult,
  SyncResult,
} from './BasketServiceInterface';

/**
 * Default tax rate (8%)
 */
const DEFAULT_TAX_RATE = 0.08;

/**
 * Basket service implementation
 * Manages basket state locally and syncs orders to platform
 */
export class BasketService implements BasketServiceInterface {
  private db: ReturnType<SQLiteStorageService['getDatabase']>;
  private logger = LoggerFactory.getInstance().createLogger('BasketService');
  private currentBasketId: string | null = null;
  private orderServiceFactory: OrderServiceFactory;

  async initialize(): Promise<void> {
    this.logger.info('Initializing basket service...');
    
    // Wait for database to be fully initialized
    this.db = SQLiteStorageService.getInstance().getDatabase();
    
    // Ensure we have a current basket
    await this.getOrCreateBasket();
    this.logger.info('Basket service initialized');
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get or create the current basket
   */
  private async getOrCreateBasket(): Promise<Basket> {
    try {
      // Try to get existing active basket
      const existingBasket = await this.db.getFirstAsync<{
        id: string;
        items: string;
        subtotal: number;
        tax: number;
        total: number;
        discount_amount: number | null;
        discount_code: string | null;
        customer_email: string | null;
        customer_name: string | null;
        note: string | null;
        created_at: number;
        updated_at: number;
      }>('SELECT * FROM baskets WHERE status = ? ORDER BY created_at DESC LIMIT 1', ['active']);

      if (existingBasket) {
        this.currentBasketId = existingBasket.id;
        return this.mapDbBasketToBasket(existingBasket);
      }

      // Create new basket
      const newBasketId = this.generateId();
      const now = Date.now();

      await this.db.runAsync(
        `INSERT INTO baskets (id, items, subtotal, tax, total, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newBasketId, '[]', 0, 0, 0, 'active', now, now]
      );

      this.currentBasketId = newBasketId;

      return {
        id: newBasketId,
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };
    } catch (error) {
      this.logger.error({ message: 'Failed to get or create basket' }, error as Error);
      throw error;
    }
  }

  /**
   * Map database basket row to Basket interface
   */
  private mapDbBasketToBasket(row: {
    id: string;
    items: string;
    subtotal: number;
    tax: number;
    total: number;
    discount_amount: number | null;
    discount_code: string | null;
    customer_email: string | null;
    customer_name: string | null;
    note: string | null;
    created_at: number;
    updated_at: number;
  }): Basket {
    return {
      id: row.id,
      items: JSON.parse(row.items) as BasketItem[],
      subtotal: row.subtotal,
      tax: row.tax,
      total: row.total,
      discountAmount: row.discount_amount ?? undefined,
      discountCode: row.discount_code ?? undefined,
      customerEmail: row.customer_email ?? undefined,
      customerName: row.customer_name ?? undefined,
      note: row.note ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Calculate basket totals
   */
  private calculateTotals(items: BasketItem[], discountAmount: number = 0): { subtotal: number; tax: number; total: number } {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxableAmount = items
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = taxableAmount * DEFAULT_TAX_RATE;
    const total = Math.max(0, subtotal + tax - discountAmount);

    return { subtotal, tax, total };
  }

  /**
   * Update basket in database
   */
  private async updateBasketInDb(basket: Basket): Promise<void> {
    const now = Date.now();
    await this.db.runAsync(
      `UPDATE baskets SET 
        items = ?, subtotal = ?, tax = ?, total = ?, 
        discount_amount = ?, discount_code = ?,
        customer_email = ?, customer_name = ?, note = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        JSON.stringify(basket.items),
        basket.subtotal,
        basket.tax,
        basket.total,
        basket.discountAmount ?? null,
        basket.discountCode ?? null,
        basket.customerEmail ?? null,
        basket.customerName ?? null,
        basket.note ?? null,
        now,
        basket.id,
      ]
    );
  }

  // ============ Basket Operations ============

  async getBasket(): Promise<Basket> {
    return this.getOrCreateBasket();
  }

  async addItem(item: Omit<BasketItem, 'id'>): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    
    // Check if item already exists (by productId and variantId)
    const existingIndex = basket.items.findIndex(
      i => i.productId === item.productId && i.variantId === item.variantId
    );

    if (existingIndex !== -1) {
      // Update quantity
      basket.items[existingIndex].quantity += item.quantity;
    } else {
      // Add new item
      const newItem: BasketItem = {
        ...item,
        id: this.generateId(),
      };
      basket.items.push(newItem);
    }

    // Recalculate totals
    const totals = this.calculateTotals(basket.items, basket.discountAmount);
    basket.subtotal = totals.subtotal;
    basket.tax = totals.tax;
    basket.total = totals.total;
    basket.updatedAt = new Date();

    await this.updateBasketInDb(basket);
    return basket;
  }

  async updateItemQuantity(itemId: string, quantity: number): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    
    if (quantity <= 0) {
      // Remove item
      basket.items = basket.items.filter(i => i.id !== itemId);
    } else {
      // Update quantity
      const item = basket.items.find(i => i.id === itemId);
      if (item) {
        item.quantity = quantity;
      }
    }

    // Recalculate totals
    const totals = this.calculateTotals(basket.items, basket.discountAmount);
    basket.subtotal = totals.subtotal;
    basket.tax = totals.tax;
    basket.total = totals.total;
    basket.updatedAt = new Date();

    await this.updateBasketInDb(basket);
    return basket;
  }

  async removeItem(itemId: string): Promise<Basket> {
    return this.updateItemQuantity(itemId, 0);
  }

  async clearBasket(): Promise<void> {
    if (!this.currentBasketId) return;

    const now = Date.now();
    await this.db.runAsync(
      `UPDATE baskets SET items = ?, subtotal = ?, tax = ?, total = ?, 
       discount_amount = NULL, discount_code = NULL, updated_at = ?
       WHERE id = ?`,
      ['[]', 0, 0, 0, now, this.currentBasketId]
    );
  }

  async applyDiscount(code: string): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    
    // TODO: Validate discount code against platform/local discounts
    // For now, we'll just store the code
    basket.discountCode = code;
    basket.discountAmount = 0; // Would be calculated based on discount rules
    basket.updatedAt = new Date();

    await this.updateBasketInDb(basket);
    return basket;
  }

  async removeDiscount(): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    
    basket.discountCode = undefined;
    basket.discountAmount = undefined;

    // Recalculate totals
    const totals = this.calculateTotals(basket.items);
    basket.subtotal = totals.subtotal;
    basket.tax = totals.tax;
    basket.total = totals.total;
    basket.updatedAt = new Date();

    await this.updateBasketInDb(basket);
    return basket;
  }

  async setCustomer(email?: string, name?: string): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    
    basket.customerEmail = email;
    basket.customerName = name;
    basket.updatedAt = new Date();

    await this.updateBasketInDb(basket);
    return basket;
  }

  async setNote(note: string): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    
    basket.note = note;
    basket.updatedAt = new Date();

    await this.updateBasketInDb(basket);
    return basket;
  }

  // ============ Checkout Operations ============

  async startCheckout(platform?: ECommercePlatform): Promise<LocalOrder> {
    const basket = await this.getOrCreateBasket();

    if (basket.items.length === 0) {
      throw new Error('Cannot checkout with empty basket');
    }

    const now = Date.now();
    const orderId = this.generateId();

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
      status: 'pending',
      syncStatus: 'pending',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    // Save to local orders table
    await this.db.runAsync(
      `INSERT INTO local_orders (
        id, platform, items, subtotal, tax, total,
        discount_amount, discount_code, customer_email, customer_name, note,
        status, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        platform ?? null,
        JSON.stringify(basket.items),
        basket.subtotal,
        basket.tax,
        basket.total,
        basket.discountAmount ?? null,
        basket.discountCode ?? null,
        basket.customerEmail ?? null,
        basket.customerName ?? null,
        basket.note ?? null,
        'pending',
        'pending',
        now,
        now,
      ]
    );

    this.logger.info(`Created local order ${orderId} from basket`);
    return localOrder;
  }

  async markPaymentProcessing(orderId: string): Promise<LocalOrder> {
    const now = Date.now();
    
    await this.db.runAsync(
      `UPDATE local_orders SET status = ?, updated_at = ? WHERE id = ?`,
      ['processing', now, orderId]
    );

    const order = await this.getLocalOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    return order;
  }

  async completePayment(
    orderId: string,
    paymentMethod: string,
    transactionId?: string
  ): Promise<CheckoutResult> {
    const now = Date.now();

    try {
      // Update order status to paid
      await this.db.runAsync(
        `UPDATE local_orders SET 
          status = ?, payment_method = ?, payment_transaction_id = ?,
          paid_at = ?, updated_at = ?
         WHERE id = ?`,
        ['paid', paymentMethod, transactionId ?? null, now, now, orderId]
      );

      // Clear the basket
      await this.clearBasket();

      // Create a new basket for next transaction
      this.currentBasketId = null;
      await this.getOrCreateBasket();

      this.logger.info(`Payment completed for order ${orderId}`);

      return {
        success: true,
        orderId,
      };
    } catch (error) {
      this.logger.error({ message: `Failed to complete payment for order ${orderId}` }, error as Error);
      
      // Mark order as failed
      await this.db.runAsync(
        `UPDATE local_orders SET status = ?, updated_at = ? WHERE id = ?`,
        ['failed', now, orderId]
      );

      return {
        success: false,
        orderId,
        error: (error as Error).message,
      };
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    const now = Date.now();
    
    await this.db.runAsync(
      `UPDATE local_orders SET status = ?, updated_at = ? WHERE id = ?`,
      ['cancelled', now, orderId]
    );

    this.logger.info(`Order ${orderId} cancelled`);
  }

  // ============ Order Sync Operations ============

  async syncOrderToPlatform(orderId: string): Promise<CheckoutResult> {
    const localOrder = await this.getLocalOrder(orderId);
    
    if (!localOrder) {
      return {
        success: false,
        orderId,
        error: 'Order not found',
      };
    }

    if (localOrder.status !== 'paid') {
      return {
        success: false,
        orderId,
        error: 'Order must be paid before syncing',
      };
    }

    if (localOrder.syncStatus === 'synced') {
      return {
        success: true,
        orderId,
        platformOrderId: localOrder.platformOrderId,
      };
    }

    try {
      // Get the order service for the platform
      const orderService = this.orderServiceFactory.getService(localOrder.platform);

      // Convert to platform order format
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

      // Create order on platform
      const createdOrder = await orderService.createOrder(platformOrder);

      // Update local order with platform ID
      const now = Date.now();
      await this.db.runAsync(
        `UPDATE local_orders SET 
          platform_order_id = ?, sync_status = ?, synced_at = ?, updated_at = ?
         WHERE id = ?`,
        [createdOrder.id ?? createdOrder.platformOrderId, 'synced', now, now, orderId]
      );

      this.logger.info(`Order ${orderId} synced to platform as ${createdOrder.id}`);

      return {
        success: true,
        orderId,
        platformOrderId: createdOrder.id ?? createdOrder.platformOrderId,
      };
    } catch (error) {
      this.logger.error({ message: `Failed to sync order ${orderId} to platform` }, error as Error);

      // Update sync status to failed
      const now = Date.now();
      await this.db.runAsync(
        `UPDATE local_orders SET sync_status = ?, sync_error = ?, updated_at = ? WHERE id = ?`,
        ['failed', (error as Error).message, now, orderId]
      );

      return {
        success: false,
        orderId,
        error: (error as Error).message,
      };
    }
  }

  async syncAllPendingOrders(): Promise<SyncResult> {
    const unsyncedOrders = await this.getUnsyncedOrders();
    
    const result: SyncResult = {
      synced: 0,
      failed: 0,
      errors: [],
    };

    for (const order of unsyncedOrders) {
      const syncResult = await this.syncOrderToPlatform(order.id);
      
      if (syncResult.success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push({
          orderId: order.id,
          error: syncResult.error ?? 'Unknown error',
        });
      }
    }

    this.logger.info(`Synced ${result.synced} orders, ${result.failed} failed`);
    return result;
  }

  async getLocalOrders(status?: LocalOrderStatus): Promise<LocalOrder[]> {
    let query = 'SELECT * FROM local_orders';
    const params: (string | null)[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const rows = await this.db.getAllAsync<{
      id: string;
      platform_order_id: string | null;
      platform: string | null;
      items: string;
      subtotal: number;
      tax: number;
      total: number;
      discount_amount: number | null;
      discount_code: string | null;
      customer_email: string | null;
      customer_name: string | null;
      note: string | null;
      payment_method: string | null;
      payment_transaction_id: string | null;
      status: string;
      sync_status: string;
      sync_error: string | null;
      created_at: number;
      updated_at: number;
      paid_at: number | null;
      synced_at: number | null;
    }>(query, params);

    return rows.map(row => this.mapDbRowToLocalOrder(row));
  }

  async getUnsyncedOrders(): Promise<LocalOrder[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      platform_order_id: string | null;
      platform: string | null;
      items: string;
      subtotal: number;
      tax: number;
      total: number;
      discount_amount: number | null;
      discount_code: string | null;
      customer_email: string | null;
      customer_name: string | null;
      note: string | null;
      payment_method: string | null;
      payment_transaction_id: string | null;
      status: string;
      sync_status: string;
      sync_error: string | null;
      created_at: number;
      updated_at: number;
      paid_at: number | null;
      synced_at: number | null;
    }>(
      `SELECT * FROM local_orders 
       WHERE status = ? AND sync_status != ? 
       ORDER BY created_at ASC`,
      ['paid', 'synced']
    );

    return rows.map(row => this.mapDbRowToLocalOrder(row));
  }

  async getLocalOrder(orderId: string): Promise<LocalOrder | null> {
    const row = await this.db.getFirstAsync<{
      id: string;
      platform_order_id: string | null;
      platform: string | null;
      items: string;
      subtotal: number;
      tax: number;
      total: number;
      discount_amount: number | null;
      discount_code: string | null;
      customer_email: string | null;
      customer_name: string | null;
      note: string | null;
      payment_method: string | null;
      payment_transaction_id: string | null;
      status: string;
      sync_status: string;
      sync_error: string | null;
      created_at: number;
      updated_at: number;
      paid_at: number | null;
      synced_at: number | null;
    }>('SELECT * FROM local_orders WHERE id = ?', [orderId]);

    if (!row) return null;
    return this.mapDbRowToLocalOrder(row);
  }

  /**
   * Map database row to LocalOrder
   */
  private mapDbRowToLocalOrder(row: {
    id: string;
    platform_order_id: string | null;
    platform: string | null;
    items: string;
    subtotal: number;
    tax: number;
    total: number;
    discount_amount: number | null;
    discount_code: string | null;
    customer_email: string | null;
    customer_name: string | null;
    note: string | null;
    payment_method: string | null;
    payment_transaction_id: string | null;
    status: string;
    sync_status: string;
    sync_error: string | null;
    created_at: number;
    updated_at: number;
    paid_at: number | null;
    synced_at: number | null;
  }): LocalOrder {
    return {
      id: row.id,
      platformOrderId: row.platform_order_id ?? undefined,
      platform: row.platform as ECommercePlatform | undefined,
      items: JSON.parse(row.items) as BasketItem[],
      subtotal: row.subtotal,
      tax: row.tax,
      total: row.total,
      discountAmount: row.discount_amount ?? undefined,
      discountCode: row.discount_code ?? undefined,
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

  basketItemsToLineItems(items: BasketItem[]): OrderLineItem[] {
    return items.map(item => ({
      productId: item.originalId ?? item.productId,
      variantId: item.variantId,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      taxable: item.taxable,
      taxRate: item.taxRate ?? DEFAULT_TAX_RATE,
      taxAmount: item.taxable ? item.price * item.quantity * (item.taxRate ?? DEFAULT_TAX_RATE) : 0,
      total: item.price * item.quantity,
      properties: item.properties,
    }));
  }
}
