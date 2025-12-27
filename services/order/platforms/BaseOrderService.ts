import { Order } from '../OrderServiceInterface';
import { PlatformOrderServiceInterface, PlatformConfigRequirements, PlatformOrderConfig } from './PlatformOrderServiceInterface';

/**
 * Base abstract class for platform-specific order service implementations
 * Provides common functionality for all platform order services
 */
export abstract class BaseOrderService implements PlatformOrderServiceInterface {
  protected initialized: boolean = false;
  protected config: PlatformOrderConfig;

  /**
   * Creates a new platform order service
   * @param config Platform-specific configuration
   */
  constructor(config: PlatformOrderConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the order service
   * Each platform must implement this to handle platform-specific initialization
   */
  abstract initialize(): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get configuration requirements for this platform
   * Each platform must implement this to specify its required config fields
   */
  abstract getConfigRequirements(): PlatformConfigRequirements;

  /**
   * Create a new order in the e-commerce platform
   * Each platform must implement this with its specific API calls
   */
  abstract createOrder(order: Order): Promise<Order>;

  /**
   * Get an existing order by ID
   * Each platform must implement this with its specific API calls
   */
  abstract getOrder(orderId: string): Promise<Order | null>;

  /**
   * Update an existing order
   * Each platform must implement this with its specific API calls
   */
  abstract updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null>;

  // Refund functionality moved to dedicated refund service

  /**
   * Create authorization headers for API requests
   * Utility method for platform implementations
   */
  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  /**
   * Map a platform-specific order to the standard Order format
   * This can be overridden by platform-specific implementations
   */
  protected mapToOrder(platformOrder: any): Order {
    const lineItems =
      platformOrder.line_items?.map((item: any) => ({
        id: item.id?.toString(),
        productId: item.product_id?.toString() || '',
        variantId: item.variant_id?.toString(),
        sku: item.sku,
        name: item.name || item.title || '',
        quantity: item.quantity || 0,
        price: parseFloat(item.price || '0'),
        taxable: item.taxable !== false,
        taxRate: item.tax_rate ? parseFloat(item.tax_rate) : undefined,
        taxAmount: item.tax_amount ? parseFloat(item.tax_amount) : undefined,
        discountAmount: item.discount_amount ? parseFloat(item.discount_amount) : undefined,
        total: parseFloat(item.total || item.price * item.quantity || '0'),
        properties: item.properties || {},
      })) || [];

    const discounts =
      platformOrder.discounts?.map((discount: any) => ({
        code: discount.code,
        amount: parseFloat(discount.amount || '0'),
        type: discount.type || 'fixed_amount',
        description: discount.description || discount.title || '',
      })) || [];

    const mapAddress = (address: any) => {
      if (!address) return undefined;
      return {
        firstName: address.first_name || address.firstName,
        lastName: address.last_name || address.lastName,
        company: address.company,
        address1: address.address1 || address.address_1,
        address2: address.address2 || address.address_2,
        city: address.city,
        province: address.province || address.state,
        provinceCode: address.province_code || address.state_code,
        country: address.country,
        countryCode: address.country_code,
        zip: address.zip || address.postal_code,
        phone: address.phone,
      };
    };

    return {
      id: platformOrder.id?.toString(),
      platformOrderId: platformOrder.platform_order_id || platformOrder.platformOrderId || platformOrder.id?.toString(),
      customerEmail: platformOrder.customer_email || platformOrder.customerEmail || platformOrder.email,
      customerName: platformOrder.customer_name || platformOrder.customerName || platformOrder.name,
      lineItems,
      subtotal: parseFloat(platformOrder.subtotal || '0'),
      tax: parseFloat(platformOrder.tax || platformOrder.total_tax || '0'),
      total: parseFloat(platformOrder.total || '0'),
      discounts,
      shippingAddress: mapAddress(platformOrder.shipping_address || platformOrder.shippingAddress),
      billingAddress: mapAddress(platformOrder.billing_address || platformOrder.billingAddress),
      paymentStatus: platformOrder.payment_status || platformOrder.paymentStatus || 'pending',
      fulfillmentStatus: platformOrder.fulfillment_status || platformOrder.fulfillmentStatus || 'unfulfilled',
      note: platformOrder.note || platformOrder.customer_note,
      tags: platformOrder.tags ? (typeof platformOrder.tags === 'string' ? platformOrder.tags.split(',') : platformOrder.tags) : [],
      createdAt: platformOrder.created_at
        ? new Date(platformOrder.created_at)
        : platformOrder.createdAt
          ? new Date(platformOrder.createdAt)
          : undefined,
      updatedAt: platformOrder.updated_at
        ? new Date(platformOrder.updated_at)
        : platformOrder.updatedAt
          ? new Date(platformOrder.updatedAt)
          : undefined,
    };
  }
}
