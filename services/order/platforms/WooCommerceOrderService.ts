import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { createBasicAuthHeader } from '../../../utils/base64';
import { WOOCOMMERCE_API_VERSION } from '../../config/ServiceConfigBridge';

/**
 * WooCommerce-specific implementation of the order service
 */
export class WooCommerceOrderService extends BaseOrderService {
  /**
   * Create a new WooCommerce order service
   * @param config Configuration for WooCommerce API
   */
  constructor(config: PlatformOrderConfig = {}) {
    super(config);
  }

  /**
   * Initialize the WooCommerce order service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.consumerKey = this.config.consumerKey || process.env.WOOCOMMERCE_KEY || '';
      this.config.consumerSecret = this.config.consumerSecret || process.env.WOOCOMMERCE_SECRET || '';
      this.config.storeUrl = this.config.storeUrl || process.env.WOOCOMMERCE_URL || '';

      if (!this.config.consumerKey || !this.config.consumerSecret || !this.config.storeUrl) {
        console.warn('Missing WooCommerce API configuration');
        return false;
      }

      // Normalize the store URL
      this.config.storeUrl = this.normalizeStoreUrl(this.config.storeUrl);

      // Test connection with a simple API call
      try {
        const apiUrl = `${this.config.storeUrl}/wp-json/${WOOCOMMERCE_API_VERSION}/`;
        const response = await fetch(apiUrl, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to WooCommerce API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to WooCommerce API', error);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize WooCommerce order service', error);
      return false;
    }
  }

  /**
   * Get configuration requirements for WooCommerce
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['consumerKey', 'consumerSecret', 'storeUrl'],
      optional: ['version', 'webhookUrl'],
      description: 'WooCommerce order service requires consumer key, consumer secret, and store URL',
    };
  }

  /**
   * Create a new order in WooCommerce
   */
  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce order service not initialized');
    }

    try {
      const apiUrl = `${this.config.storeUrl}/wp-json/${WOOCOMMERCE_API_VERSION}/orders`;

      const wooOrder = this.mapToWooCommerceOrder(order);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wooOrder),
      });

      if (!response.ok) {
        throw new Error(`Failed to create order on WooCommerce: ${response.statusText}`);
      }

      const data = await response.json();

      // Map created WooCommerce order to our format
      return this.mapToOrder(data);
    } catch (error) {
      console.error('Error creating order on WooCommerce', error);
      throw error;
    }
  }

  /**
   * Get an order by ID from WooCommerce
   */
  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce order service not initialized');
    }

    try {
      const apiUrl = `${this.config.storeUrl}/wp-json/${WOOCOMMERCE_API_VERSION}/orders/${orderId}`;

      const response = await fetch(apiUrl, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch order from WooCommerce: ${response.statusText}`);
      }

      const data = await response.json();

      // Map WooCommerce order to our format
      return this.mapToOrder(data);
    } catch (error) {
      console.error(`Error fetching order ${orderId} from WooCommerce`, error);
      return null;
    }
  }

  /**
   * Update an order on WooCommerce
   */
  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce order service not initialized');
    }

    try {
      const apiUrl = `${this.config.storeUrl}/wp-json/${WOOCOMMERCE_API_VERSION}/orders/${orderId}`;

      // Get the existing order
      const existingOrder = await this.getOrder(orderId);
      if (!existingOrder) {
        throw new Error(`Order with ID ${orderId} not found`);
      }

      // Merge the existing order with the update data
      const updatedOrder = { ...existingOrder, ...updates };

      // Map to WooCommerce format
      const wooOrder = this.mapToWooCommerceOrder(updatedOrder);

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wooOrder),
      });

      if (!response.ok) {
        throw new Error(`Failed to update order on WooCommerce: ${response.statusText}`);
      }

      const data = await response.json();

      // Map updated WooCommerce order to our format
      return this.mapToOrder(data);
    } catch (error) {
      console.error(`Error updating order ${orderId} on WooCommerce`, error);
      return null;
    }
  }

  // Refund functionality moved to dedicated refund service

  /**
   * Create authorization headers for WooCommerce API
   * Uses basic authentication with consumer key and consumer secret
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: createBasicAuthHeader(this.config.consumerKey as string, this.config.consumerSecret as string),
      'Content-Type': 'application/json',
    };
  }

  /**
   * Map our order format to WooCommerce's format
   */
  private mapToWooCommerceOrder(order: Order): any {
    const lineItems = order.lineItems.map(item => ({
      product_id: item.productId,
      variation_id: item.variantId,
      quantity: item.quantity,
      price: item.price,
      name: item.name,
      sku: item.sku,
      total: item.total.toString(),
      meta_data: Object.entries(item.properties || {}).map(([key, value]) => ({
        key,
        value,
      })),
    }));

    const mapAddress = (address?: any) => {
      if (!address) return {};
      return {
        first_name: address.firstName,
        last_name: address.lastName,
        company: address.company,
        address_1: address.address1,
        address_2: address.address2,
        city: address.city,
        state: address.province,
        postcode: address.zip,
        country: address.country,
        phone: address.phone,
      };
    };

    // Map the order status
    let status = 'pending';
    if (order.paymentStatus === 'paid') {
      status = 'processing';
    } else if (order.paymentStatus === 'refunded') {
      status = 'refunded';
    } else if (order.fulfillmentStatus === 'fulfilled') {
      status = 'completed';
    }

    return {
      status,
      billing: mapAddress(order.billingAddress),
      shipping: mapAddress(order.shippingAddress),
      line_items: lineItems,
      customer_note: order.note,
      customer_id: 0, // Guest order if not specified
      payment_method: order.paymentStatus === 'paid' ? 'cod' : 'bacs', // Default to Cash on Delivery or Bank Transfer
      set_paid: order.paymentStatus === 'paid',
    };
  }

  /**
   * Override the base class mapping to handle WooCommerce specific fields
   */
  protected mapToOrder(wooOrder: any): Order {
    const lineItems =
      wooOrder.line_items?.map((item: any) => ({
        id: item.id?.toString(),
        productId: item.product_id?.toString() || '',
        variantId: item.variation_id?.toString(),
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price || '0'),
        taxable: true,
        total: parseFloat(item.total || '0'),
        properties: item.meta_data?.reduce((acc: Record<string, string>, meta: any) => {
          acc[meta.key] = meta.value;
          return acc;
        }, {}),
      })) || [];

    // Map the WooCommerce order status to our payment and fulfillment status
    let paymentStatus: Order['paymentStatus'] = 'pending';
    let fulfillmentStatus: Order['fulfillmentStatus'] = 'unfulfilled';

    if (wooOrder.status === 'completed') {
      paymentStatus = 'paid';
      fulfillmentStatus = 'fulfilled';
    } else if (wooOrder.status === 'processing') {
      paymentStatus = 'paid';
    } else if (wooOrder.status === 'refunded') {
      paymentStatus = 'refunded';
    }

    return {
      id: wooOrder.id?.toString(),
      platformOrderId: wooOrder.id?.toString(),
      customerEmail: wooOrder.billing?.email,
      customerName: `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim(),
      lineItems,
      subtotal: parseFloat(wooOrder.subtotal || '0'),
      tax: parseFloat(wooOrder.total_tax || '0'),
      total: parseFloat(wooOrder.total || '0'),
      shippingAddress: {
        firstName: wooOrder.shipping?.first_name,
        lastName: wooOrder.shipping?.last_name,
        company: wooOrder.shipping?.company,
        address1: wooOrder.shipping?.address_1,
        address2: wooOrder.shipping?.address_2,
        city: wooOrder.shipping?.city,
        province: wooOrder.shipping?.state,
        zip: wooOrder.shipping?.postcode,
        country: wooOrder.shipping?.country,
        phone: wooOrder.shipping?.phone,
      },
      billingAddress: {
        firstName: wooOrder.billing?.first_name,
        lastName: wooOrder.billing?.last_name,
        company: wooOrder.billing?.company,
        address1: wooOrder.billing?.address_1,
        address2: wooOrder.billing?.address_2,
        city: wooOrder.billing?.city,
        province: wooOrder.billing?.state,
        zip: wooOrder.billing?.postcode,
        country: wooOrder.billing?.country,
        phone: wooOrder.billing?.phone,
      },
      paymentStatus,
      fulfillmentStatus,
      note: wooOrder.customer_note,
      createdAt: wooOrder.date_created ? new Date(wooOrder.date_created) : undefined,
      updatedAt: wooOrder.date_modified ? new Date(wooOrder.date_modified) : undefined,
    };
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
