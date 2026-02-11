import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { SHOPIFY_API_VERSION } from '../../config/ServiceConfigBridge';
import { QueuedApiService } from '../../queue/QueuedApiService';

/**
 * Shopify-specific implementation of the order service
 */
export class ShopifyOrderService extends BaseOrderService {
  // The config property is inherited from BaseOrderService

  /**
   * Create a new Shopify order service
   * @param config Configuration for Shopify API
   */
  constructor(config: PlatformOrderConfig = {}) {
    super(config);
  }

  /**
   * Initialize the Shopify order service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.apiKey = this.config.apiKey || process.env.SHOPIFY_API_KEY || '';
      this.config.apiSecret = this.config.apiSecret || process.env.SHOPIFY_API_SECRET || '';
      this.config.storeUrl = this.config.storeUrl || process.env.SHOPIFY_STORE_URL || '';
      this.config.accessToken = this.config.accessToken || process.env.SHOPIFY_ACCESS_TOKEN || '';

      if (!this.config.apiKey || !this.config.accessToken || !this.config.storeUrl) {
        console.warn('Missing Shopify API configuration');
        return false;
      }

      // Normalize the store URL
      this.config.storeUrl = this.normalizeStoreUrl(this.config.storeUrl);

      // Test connection with a simple API call
      try {
        const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
        const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/shop.json`;
        const response = await fetch(apiUrl, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to Shopify API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to Shopify API', error);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize Shopify order service', error);
      return false;
    }
  }

  /**
   * Get configuration requirements for Shopify
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiKey', 'accessToken', 'storeUrl'],
      optional: ['apiVersion', 'webhookUrl'],
      description: 'Shopify order service requires API key, access token, and store URL',
    };
  }

  /**
   * Create a new order in Shopify
   */
  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('Shopify order service not initialized');
    }

    try {
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/orders.json`;

      const shopifyOrder = this.mapToShopifyOrder(order);

      // For now, keep using direct API call but add X-Request-ID header for idempotency
      const requestId = `shopify_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response = await QueuedApiService.directRequestWithBody(
        apiUrl,
        'POST',
        { order: shopifyOrder },
        {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create order on Shopify: ${response.statusText}`);
      }

      const data = await response.json();

      // Map created Shopify order to our format
      return this.mapToOrder(data.order);
    } catch (error) {
      console.error('Error creating Shopify order:', error);
      throw error;
    }
  }

  /**
   * Get an order by ID from Shopify
   */
  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Shopify order service not initialized');
    }

    try {
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/orders/${orderId}.json`;

      const response = await fetch(apiUrl, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch order from Shopify: ${response.statusText}`);
      }

      const data = await response.json();

      // Map Shopify order to our format
      return this.mapToOrder(data.order);
    } catch (error) {
      console.error(`Error fetching order ${orderId} from Shopify`, error);
      return null;
    }
  }

  /**
   * Update an order on Shopify
   */
  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Shopify order service not initialized');
    }

    try {
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/orders/${orderId}.json`;

      // Get the existing order
      const existingOrder = await this.getOrder(orderId);
      if (!existingOrder) {
        throw new Error(`Order with ID ${orderId} not found`);
      }

      // Merge the existing order with the update data
      const updatedOrder = { ...existingOrder, ...updates };

      // Map to Shopify format
      const shopifyOrder = this.mapToShopifyOrder(updatedOrder);

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order: shopifyOrder }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update order on Shopify: ${response.statusText}`);
      }

      const data = await response.json();

      // Map updated Shopify order to our format
      return this.mapToOrder(data.order);
    } catch (error) {
      console.error(`Error updating order ${orderId} on Shopify`, error);
      return null;
    }
  }

  // Refund functionality moved to dedicated refund service

  /**
   * Create authorization headers for Shopify API
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      'X-Shopify-Access-Token': this.config.accessToken || '',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Map our order format to Shopify's format
   */
  private mapToShopifyOrder(order: Order): any {
    const lineItems = order.lineItems.map(item => ({
      variant_id: item.variantId,
      quantity: item.quantity,
      price: item.price,
      title: item.name,
      sku: item.sku,
      taxable: item.taxable,
      properties: Object.entries(item.properties || {}).map(([key, value]) => ({
        name: key,
        value,
      })),
    }));

    const discounts = order.discounts?.map(discount => ({
      code: discount.code,
      type: discount.type,
      amount: discount.amount,
      description: discount.description,
    }));

    const mapAddress = (address?: any) => {
      if (!address) return undefined;
      return {
        first_name: address.firstName,
        last_name: address.lastName,
        company: address.company,
        address1: address.address1,
        address2: address.address2,
        city: address.city,
        province: address.province,
        province_code: address.provinceCode,
        country: address.country,
        country_code: address.countryCode,
        zip: address.zip,
        phone: address.phone,
      };
    };

    return {
      email: order.customerEmail,
      note: order.note,
      tags: order.tags?.join(','),
      line_items: lineItems,
      discount_codes: discounts,
      shipping_address: mapAddress(order.shippingAddress),
      billing_address: mapAddress(order.billingAddress),
      financial_status: order.paymentStatus,
      fulfillment_status: order.fulfillmentStatus,
      // Many more fields could be added as needed for specific Shopify requirements
    };
  }

  /**
   * Override the base class mapping to handle Shopify specific fields
   */
  protected mapToOrder(shopifyOrder: any): Order {
    // Start with the base class mapping
    const order = super.mapToOrder(shopifyOrder);

    // Add Shopify-specific mappings
    if (shopifyOrder.customer) {
      order.customerName = `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`.trim();
      order.customerEmail = shopifyOrder.customer.email;
    }

    return order;
  }

  /**
   * Normalize the store URL to ensure it has the correct format
   */
  private normalizeStoreUrl(url: string): string {
    if (!url) return '';

    // Remove trailing slash
    url = url.replace(/\/$/, '');

    // Ensure https:// prefix
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    return url;
  }
}
