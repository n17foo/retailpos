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
  paymentStatus?: 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
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
  taxable: boolean;
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
 * Interface for order-related operations in an e-commerce platform
 */
export interface OrderServiceInterface {
  /**
   * Create a new order in the e-commerce platform
   * @param order Order details to be created
   * @returns Promise resolving to the created order with platform-specific IDs
   */
  createOrder(order: Order): Promise<Order>;

  /**
   * Get an existing order by ID
   * @param orderId The ID of the order to retrieve
   * @returns Promise resolving to the order if found
   */
  getOrder(orderId: string): Promise<Order | null>;

  /**
   * Update an existing order
   * @param orderId The ID of the order to update
   * @param updates The order properties to update
   * @returns Promise resolving to the updated order
   */
  updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null>;

  // Refund functionality moved to dedicated refund service
}
