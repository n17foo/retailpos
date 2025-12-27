import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { MAGENTO_API_VERSION } from '../../config/ServiceConfigBridge';

/**
 * Magento-specific implementation of the order service
 * Supports Magento 2.x REST API
 */
export class MagentoOrderService extends BaseOrderService {
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;

  constructor(config: PlatformOrderConfig = {}) {
    super(config);
  }

  /**
   * Initialize the Magento order service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration
      this.config.storeUrl = this.config.storeUrl || process.env.MAGENTO_STORE_URL || '';
      this.config.username = this.config.username || process.env.MAGENTO_USERNAME || '';
      this.config.password = this.config.password || process.env.MAGENTO_PASSWORD || '';
      this.config.accessToken = this.config.accessToken || process.env.MAGENTO_ACCESS_TOKEN || '';
      this.config.apiVersion = this.config.apiVersion || process.env.MAGENTO_API_VERSION || MAGENTO_API_VERSION;

      // Normalize store URL
      this.config.storeUrl = this.normalizeStoreUrl(this.config.storeUrl);

      if (!this.config.storeUrl) {
        console.warn('Missing Magento store URL configuration');
        return false;
      }

      // Get auth token if needed
      if (!this.config.accessToken && this.config.username && this.config.password) {
        const token = await this.getAuthToken();
        if (!token) {
          console.error('Failed to authenticate with Magento');
          return false;
        }
      }

      // Test connection
      try {
        const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/orders?searchCriteria[pageSize]=1`;
        const response = await fetch(apiUrl, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to Magento API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to Magento API', error);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize Magento order service', error);
      return false;
    }
  }

  /**
   * Get configuration requirements
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl'],
      optional: ['username', 'password', 'accessToken', 'apiVersion'],
      description: 'Magento requires store URL and either username/password or access token',
    };
  }

  /**
   * Create a new order in Magento
   */
  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('Magento order service not initialized');
    }

    try {
      // First create a cart
      const cartId = await this.createCart();

      // Add items to cart
      for (const item of order.lineItems) {
        await this.addItemToCart(cartId, item);
      }

      // Set shipping/billing info and place order
      const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/carts/${cartId}/order`;

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethod: {
            method: 'checkmo', // Check/Money Order - for POS use
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create order on Magento: ${response.statusText}`);
      }

      const orderId = await response.json();

      // Fetch the created order
      return (await this.getOrder(String(orderId))) as Order;
    } catch (error) {
      console.error('Error creating order on Magento', error);
      throw error;
    }
  }

  /**
   * Create a cart for order creation
   */
  private async createCart(): Promise<string> {
    const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/carts`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to create cart');
    }

    return await response.json();
  }

  /**
   * Add item to cart
   */
  private async addItemToCart(cartId: string, item: Order['lineItems'][0]): Promise<void> {
    const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/carts/${cartId}/items`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartItem: {
          sku: item.sku,
          qty: item.quantity,
          quote_id: cartId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add item ${item.sku} to cart`);
    }
  }

  /**
   * Get an order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Magento order service not initialized');
    }

    try {
      const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/orders/${orderId}`;

      const response = await fetch(apiUrl, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch order from Magento: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapToOrder(data);
    } catch (error) {
      console.error(`Error fetching order ${orderId} from Magento`, error);
      return null;
    }
  }

  /**
   * Update an order on Magento
   */
  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Magento order service not initialized');
    }

    try {
      // Magento has limited order update capabilities
      // We can add comments or update status
      const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/orders/${orderId}/comments`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statusHistory: {
            comment: updates.note || 'Order updated from POS',
            is_customer_notified: 0,
            is_visible_on_front: 0,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update order on Magento: ${response.statusText}`);
      }

      return await this.getOrder(orderId);
    } catch (error) {
      console.error(`Error updating order ${orderId} on Magento`, error);
      return null;
    }
  }

  /**
   * Get admin authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    if (this.accessToken && this.tokenExpiration && this.tokenExpiration > new Date()) {
      return this.accessToken;
    }

    try {
      const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/integration/admin/token`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const token = await response.json();
      this.accessToken = token;
      this.tokenExpiration = new Date(Date.now() + 4 * 60 * 60 * 1000);

      return token;
    } catch (error) {
      console.error('Error getting Magento auth token', error);
      return null;
    }
  }

  /**
   * Get authorization headers
   */
  protected getAuthHeaders(): Record<string, string> {
    const token = this.config.accessToken || this.accessToken || '';
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Normalize store URL
   */
  private normalizeStoreUrl(url: string): string {
    if (!url) return '';
    url = url.replace(/\/$/, '');
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  }

  /**
   * Map Magento order to our format
   */
  protected mapToOrder(magentoOrder: any): Order {
    const lineItems = (magentoOrder.items || []).map((item: any) => ({
      id: String(item.item_id),
      productId: String(item.product_id),
      variantId: undefined,
      sku: item.sku,
      name: item.name,
      quantity: item.qty_ordered,
      price: parseFloat(item.price || '0'),
      taxable: true,
      taxAmount: parseFloat(item.tax_amount || '0'),
      total: parseFloat(item.row_total || '0'),
      properties: {},
    }));

    // Map Magento status to our status
    let paymentStatus: Order['paymentStatus'] = 'pending';
    let fulfillmentStatus: Order['fulfillmentStatus'] = 'unfulfilled';

    if (magentoOrder.status === 'complete') {
      paymentStatus = 'paid';
      fulfillmentStatus = 'fulfilled';
    } else if (magentoOrder.status === 'processing') {
      paymentStatus = 'paid';
    } else if (magentoOrder.status === 'closed') {
      paymentStatus = 'refunded';
    }

    const mapAddress = (address: any) => {
      if (!address) return undefined;
      return {
        firstName: address.firstname,
        lastName: address.lastname,
        company: address.company,
        address1: address.street?.[0],
        address2: address.street?.[1],
        city: address.city,
        province: address.region,
        provinceCode: address.region_code,
        country: address.country_id,
        zip: address.postcode,
        phone: address.telephone,
      };
    };

    return {
      id: String(magentoOrder.entity_id),
      platformOrderId: magentoOrder.increment_id,
      customerEmail: magentoOrder.customer_email,
      customerName: `${magentoOrder.customer_firstname || ''} ${magentoOrder.customer_lastname || ''}`.trim(),
      lineItems,
      subtotal: parseFloat(magentoOrder.subtotal || '0'),
      tax: parseFloat(magentoOrder.tax_amount || '0'),
      total: parseFloat(magentoOrder.grand_total || '0'),
      shippingAddress: mapAddress(magentoOrder.extension_attributes?.shipping_assignments?.[0]?.shipping?.address),
      billingAddress: mapAddress(magentoOrder.billing_address),
      paymentStatus,
      fulfillmentStatus,
      note: magentoOrder.customer_note,
      createdAt: magentoOrder.created_at ? new Date(magentoOrder.created_at) : undefined,
      updatedAt: magentoOrder.updated_at ? new Date(magentoOrder.updated_at) : undefined,
    };
  }
}
