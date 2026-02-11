import { Order, OrderLineItem } from '../order/OrderServiceInterface';
import { ECommercePlatform } from '../../utils/platforms';

/**
 * Represents an item in the basket
 */
export interface BasketItem {
  id: string;
  productId: string;
  variantId?: string;
  sku?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  taxable: boolean;
  taxRate?: number;
  isEcommerceProduct?: boolean;
  originalId?: string; // Original platform ID for ecommerce products
  properties?: Record<string, string>;
}

/**
 * Represents the current basket state
 */
export interface Basket {
  id: string;
  items: BasketItem[];
  subtotal: number;
  tax: number;
  total: number;
  discountAmount?: number;
  discountCode?: string;
  customerEmail?: string;
  customerName?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Status of a local order
 */
export type LocalOrderStatus =
  | 'pending' // Order created, awaiting payment
  | 'processing' // Payment in progress
  | 'paid' // Payment completed
  | 'synced' // Order synced to platform
  | 'failed' // Order/payment failed
  | 'cancelled'; // Order cancelled

/**
 * Represents an order stored locally
 */
export interface LocalOrder {
  id: string;
  platformOrderId?: string;
  platform?: ECommercePlatform;
  items: BasketItem[];
  subtotal: number;
  tax: number;
  total: number;
  discountAmount?: number;
  discountCode?: string;
  customerEmail?: string;
  customerName?: string;
  note?: string;
  paymentMethod?: string;
  paymentTransactionId?: string;
  cashierId?: string;
  cashierName?: string;
  status: LocalOrderStatus;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  syncedAt?: Date;
}

/**
 * Result of checkout operation
 */
export interface CheckoutResult {
  success: boolean;
  orderId: string;
  platformOrderId?: string;
  error?: string;
}

/**
 * Result of sync operation
 */
export interface SyncResult {
  synced: number;
  failed: number;
  errors: Array<{
    orderId: string;
    error: string;
  }>;
}

/**
 * Interface for basket service operations
 */
export interface BasketServiceInterface {
  /**
   * Initialize the basket service
   */
  initialize(): Promise<void>;

  // ============ Basket Operations ============

  /**
   * Get the current basket
   */
  getBasket(): Promise<Basket>;

  /**
   * Add an item to the basket
   * @param item The item to add
   */
  addItem(item: Omit<BasketItem, 'id'>): Promise<Basket>;

  /**
   * Update an item quantity in the basket
   * @param itemId The item ID
   * @param quantity The new quantity (0 removes the item)
   */
  updateItemQuantity(itemId: string, quantity: number): Promise<Basket>;

  /**
   * Remove an item from the basket
   * @param itemId The item ID to remove
   */
  removeItem(itemId: string): Promise<Basket>;

  /**
   * Clear all items from the basket
   */
  clearBasket(): Promise<void>;

  /**
   * Apply a discount code to the basket
   * @param code The discount code
   */
  applyDiscount(code: string): Promise<Basket>;

  /**
   * Remove discount from the basket
   */
  removeDiscount(): Promise<Basket>;

  /**
   * Set customer information on the basket
   * @param email Customer email
   * @param name Customer name
   */
  setCustomer(email?: string, name?: string): Promise<Basket>;

  /**
   * Set a note on the basket
   * @param note The note text
   */
  setNote(note: string): Promise<Basket>;

  // ============ Checkout Operations ============

  /**
   * Start checkout - creates a local order from the basket
   * The order is created with 'pending' status
   * @param platform Optional platform to create order on
   * @param cashierId Optional ID of the cashier placing the order
   * @param cashierName Optional name of the cashier placing the order
   */
  startCheckout(platform?: ECommercePlatform, cashierId?: string, cashierName?: string): Promise<LocalOrder>;

  /**
   * Mark order as processing (payment in progress)
   * @param orderId The local order ID
   */
  markPaymentProcessing(orderId: string): Promise<LocalOrder>;

  /**
   * Complete payment - marks order as paid and clears basket
   * @param orderId The local order ID
   * @param paymentMethod The payment method used
   * @param transactionId The payment transaction ID
   */
  completePayment(orderId: string, paymentMethod: string, transactionId?: string): Promise<CheckoutResult>;

  /**
   * Cancel an order
   * @param orderId The local order ID
   */
  cancelOrder(orderId: string): Promise<void>;

  // ============ Order Sync Operations ============

  /**
   * Sync a paid order to the platform
   * @param orderId The local order ID
   */
  syncOrderToPlatform(orderId: string): Promise<CheckoutResult>;

  /**
   * Sync all unsynced paid orders to their platforms
   */
  syncAllPendingOrders(): Promise<SyncResult>;

  /**
   * Get all local orders
   * @param status Optional filter by status
   */
  getLocalOrders(status?: LocalOrderStatus): Promise<LocalOrder[]>;

  /**
   * Get unsynced orders (paid but not synced to platform)
   */
  getUnsyncedOrders(): Promise<LocalOrder[]>;

  /**
   * Get a specific local order
   * @param orderId The local order ID
   */
  getLocalOrder(orderId: string): Promise<LocalOrder | null>;

  /**
   * Convert basket items to order line items
   */
  basketItemsToLineItems(items: BasketItem[]): OrderLineItem[];
}
