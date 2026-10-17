/**
 * Represents an order in the system
 */
export interface Order {
  id?: string;
  platformOrderId?: string;
  customerEmail?: string;
  customerName?: string;
  lineItems: OrderLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  discounts?: Discount[];
  shippingAddress?: Address;
  billingAddress?: Address;
  /**
   * Payment status as understood by the platform.
   * 'draft' is used when the order is created as a draft (not yet paid).
   */
  paymentStatus?: 'draft' | 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
  fulfillmentStatus?: 'unfulfilled' | 'partially_fulfilled' | 'fulfilled';
  note?: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Represents a line item in an order
 */
export interface OrderLineItem {
  id?: string;
  productId: string;
  variantId?: string;
  sku?: string;
  name: string;
  quantity: number;
  price: number;
  taxRate?: number;
  taxAmount?: number;
  discountAmount?: number;
  total: number;
  properties?: Record<string, string>;
}

/**
 * Represents a discount applied to an order
 */
export interface Discount {
  code?: string;
  amount: number;
  type: 'percentage' | 'fixed_amount';
  description?: string;
}

/**
 * Represents a physical address
 */
export interface Address {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  provinceCode?: string;
  country?: string;
  countryCode?: string;
  zip?: string;
  phone?: string;
}

// Refund interfaces moved to refundServiceInterface.ts

/**
 * Tax calculated by the platform for a basket, obtained without leaving an order behind.
 * The POS applies the platform's effective rate to what the customer is actually charged.
 */
export interface TaxQuote {
  /** Net (tax-exclusive) items subtotal the platform calculated the tax on */
  subtotal: number;
  /** Tax the platform calculated on that subtotal */
  tax: number;
  /**
   * True when catalogue prices already include tax: the POS price is gross and the tax is a portion of it.
   * False when the tax is added on top of the price.
   */
  taxIncluded: boolean;
}

/**
 * Interface for order-related operations in an e-commerce platform.
 *
 * Draft order lifecycle (online platforms):
 *   createDraftOrder() → platform creates a draft with server-calculated tax
 *   cancelDraftOrder() → platform deletes/cancels the draft (cashier goes back to basket)
 *   completeOrder()    → platform marks the draft as paid after payment succeeds
 *
 * Platforms that don't support native drafts fall back to createOrder() and
 * implement cancelDraftOrder() as a no-op or a delete call.
 */
export interface OrderServiceInterface {
  /**
   * Create a draft order on the platform.
   * Returns the draft with platform-calculated tax, subtotal, and total.
   * The draft is not yet paid — it is confirmed via completeOrder() after payment.
   */
  createDraftOrder(order: Order): Promise<Order>;

  /**
   * Ask the platform to calculate tax for this basket (cart / quote / checkout) and discard the result.
   * Used by platforms that have no draft order. Throws when the platform cannot return the tax.
   */
  quoteTax(order: Order): Promise<TaxQuote>;

  /**
   * Cancel / delete a draft order on the platform before payment.
   * Called when the cashier returns to the basket to add/remove items.
   * Implementations should be best-effort — failures are logged but not thrown.
   */
  cancelDraftOrder(platformOrderId: string): Promise<void>;

  /**
   * Mark a draft order as paid on the platform after payment succeeds.
   * For platforms that don't support drafts, this may be equivalent to createOrder().
   */
  completeOrder(platformOrderId: string, paymentMethod: string, transactionId?: string): Promise<Order | null>;

  /**
   * Create a new order in the e-commerce platform (legacy / sync path).
   * Used by OrderSyncService when syncing a locally-paid order that has no platformOrderId.
   */
  createOrder(order: Order): Promise<Order>;

  /**
   * Get an existing order by ID
   */
  getOrder(orderId: string): Promise<Order | null>;

  /**
   * Update an existing order
   */
  updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null>;
}
