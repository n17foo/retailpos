/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { SYLIUS_API_VERSION } from '../../config/apiVersions';
import { QueuedApiService } from '../../queue/QueuedApiService';

/**
 * Sylius-specific implementation of the order service
 */
export class SyliusOrderService extends BaseOrderService {
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;

  constructor(config: PlatformOrderConfig = {}) {
    super(config);
  }

  /**
   * Initialize the Sylius order service
   */
  async initialize(): Promise<boolean> {
    try {
      this.config.apiUrl = this.config.apiUrl || process.env.SYLIUS_API_URL || '';
      this.config.apiKey = this.config.apiKey || process.env.SYLIUS_API_KEY || '';
      this.config.apiSecret = this.config.apiSecret || process.env.SYLIUS_API_SECRET || '';
      this.config.accessToken = this.config.accessToken || process.env.SYLIUS_ACCESS_TOKEN || '';
      this.config.apiVersion = this.config.apiVersion || process.env.SYLIUS_API_VERSION || SYLIUS_API_VERSION;

      if (this.config.apiUrl) {
        this.config.apiUrl = this.normalizeUrl(this.config.apiUrl);
      }

      if (!this.config.apiUrl) {
        console.warn('Missing Sylius API URL configuration');
        return false;
      }

      // Get OAuth token if needed
      if (!this.config.accessToken && this.config.apiKey && this.config.apiSecret) {
        const token = await this.getOAuthToken();
        if (!token) {
          console.error('Failed to authenticate with Sylius');
          return false;
        }
      }

      // Test connection
      try {
        const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/orders?limit=1`;
        const response = await fetch(apiUrl, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to Sylius API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to Sylius API', error);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize Sylius order service', error);
      return false;
    }
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiUrl'],
      optional: ['apiKey', 'apiSecret', 'accessToken', 'apiVersion'],
      description: 'Sylius requires API URL and authentication credentials',
    };
  }

  /**
   * Create a new order in Sylius
   */
  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('Sylius order service not initialized');
    }

    try {
      // First create a cart
      const cartToken = await this.createCart();

      // Add items to cart
      for (const item of order.lineItems) {
        await this.addItemToCart(cartToken, item);
      }

      // Complete the order
      const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/orders/${cartToken}/complete`;

      const response = await QueuedApiService.directRequestWithBody(
        apiUrl,
        'PUT',
        {
          notes: order.note,
        },
        {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create order on Sylius: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapToOrder(data);
    } catch (error) {
      console.error('Error creating order on Sylius', error);
      throw error;
    }
  }

  /**
   * Create a cart
   */
  private async createCart(): Promise<string> {
    const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/orders`;

    const response = await QueuedApiService.directRequestWithBody(
      apiUrl,
      'POST',
      {
        localeCode: 'en_US',
        channelCode: 'default',
      },
      {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create cart');
    }

    const data = await response.json();
    return data.tokenValue || data.token;
  }

  /**
   * Add item to cart
   */
  private async addItemToCart(cartToken: string, item: Order['lineItems'][0]): Promise<void> {
    const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/orders/${cartToken}/items`;

    const response = await QueuedApiService.directRequestWithBody(
      apiUrl,
      'POST',
      {
        productCode: item.sku || item.productId,
        quantity: item.quantity,
      },
      {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to add item ${item.sku} to cart`);
    }
  }

  /**
   * Get an order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Sylius order service not initialized');
    }

    try {
      const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/orders/${orderId}`;

      const response = await QueuedApiService.directRequest(apiUrl, 'GET', this.getAuthHeaders());

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch order from Sylius: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapToOrder(data);
    } catch (error) {
      console.error(`Error fetching order ${orderId} from Sylius`, error);
      return null;
    }
  }

  /**
   * Update an order on Sylius
   */
  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Sylius order service not initialized');
    }

    try {
      const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/orders/${orderId}`;

      const response = await QueuedApiService.directRequestWithBody(
        apiUrl,
        'PATCH',
        {
          notes: updates.note,
        },
        {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/merge-patch+json',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update order on Sylius: ${response.statusText}`);
      }

      return await this.getOrder(orderId);
    } catch (error) {
      console.error(`Error updating order ${orderId} on Sylius`, error);
      return null;
    }
  }

  /**
   * Get OAuth token
   */
  private async getOAuthToken(): Promise<string | null> {
    if (this.accessToken && this.tokenExpiration && this.tokenExpiration > new Date()) {
      return this.accessToken;
    }

    try {
      const apiUrl = `${this.config.apiUrl}/api/oauth/v2/token`;

      const response = await QueuedApiService.directRequestWithBody(
        apiUrl,
        'POST',
        {
          grant_type: 'client_credentials',
          client_id: this.config.apiKey as string,
          client_secret: this.config.apiSecret as string,
        },
        { 'Content-Type': 'application/x-www-form-urlencoded' }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiration = new Date(Date.now() + (data.expires_in || 3600) * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('Error getting Sylius OAuth token', error);
      return null;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const token = this.config.accessToken || this.accessToken || '';
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    url = url.replace(/\/$/, '');
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  }

  protected mapToOrder(syliusOrder: any): Order {
    const lineItems = (syliusOrder.items || []).map((item: any) => ({
      id: String(item.id),
      productId: item.product?.code || String(item.productId),
      variantId: item.variant?.code,
      sku: item.variant?.code || item.productCode,
      name: item.productName || item.variant?.name || '',
      quantity: item.quantity,
      price: (item.unitPrice || 0) / 100,
      taxable: true,
      total: (item.total || 0) / 100,
      properties: {},
    }));

    let paymentStatus: Order['paymentStatus'] = 'pending';
    let fulfillmentStatus: Order['fulfillmentStatus'] = 'unfulfilled';

    if (syliusOrder.paymentState === 'paid' || syliusOrder.paymentState === 'completed') {
      paymentStatus = 'paid';
    } else if (syliusOrder.paymentState === 'refunded') {
      paymentStatus = 'refunded';
    }

    if (syliusOrder.shippingState === 'shipped') {
      fulfillmentStatus = 'fulfilled';
    }

    const mapAddress = (address: any) => {
      if (!address) return undefined;
      return {
        firstName: address.firstName,
        lastName: address.lastName,
        company: address.company,
        address1: address.street,
        city: address.city,
        province: address.provinceName,
        provinceCode: address.provinceCode,
        country: address.countryCode,
        zip: address.postcode,
        phone: address.phoneNumber,
      };
    };

    return {
      id: syliusOrder.tokenValue || String(syliusOrder.id),
      platformOrderId: syliusOrder.number,
      customerEmail: syliusOrder.customer?.email,
      customerName: `${syliusOrder.customer?.firstName || ''} ${syliusOrder.customer?.lastName || ''}`.trim(),
      lineItems,
      subtotal: (syliusOrder.itemsTotal || 0) / 100,
      tax: (syliusOrder.taxTotal || 0) / 100,
      total: (syliusOrder.total || 0) / 100,
      shippingAddress: mapAddress(syliusOrder.shippingAddress),
      billingAddress: mapAddress(syliusOrder.billingAddress),
      paymentStatus,
      fulfillmentStatus,
      note: syliusOrder.notes,
      createdAt: syliusOrder.createdAt ? new Date(syliusOrder.createdAt) : undefined,
      updatedAt: syliusOrder.updatedAt ? new Date(syliusOrder.updatedAt) : undefined,
    };
  }
}
