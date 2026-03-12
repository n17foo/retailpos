/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { SyliusApiClient } from '../../clients/sylius/SyliusApiClient';

/**
 * Sylius-specific implementation of the order service
 */
export class SyliusOrderService extends BaseOrderService {
  private apiClient = SyliusApiClient.getInstance();

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
      this.config.apiVersion = this.config.apiVersion || process.env.SYLIUS_API_VERSION || '';

      if (!this.config.apiUrl) {
        this.logger.warn({ message: 'Missing Sylius API URL configuration' });
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.apiUrl as string,
          accessToken: this.config.accessToken as string,
          apiVersion: this.config.apiVersion as string,
        });
        await this.apiClient.initialize();
      }

      try {
        await this.apiClient.get('orders', { limit: '1' });
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Sylius API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Sylius order service' },
        error instanceof Error ? error : new Error(String(error))
      );
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

      const data = await this.apiClient.put<any>(`orders/${cartToken}/complete`, { notes: order.note });
      return this.mapToOrder(data);
    } catch (error) {
      this.logger.error({ message: 'Error creating order on Sylius' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Create a cart
   */
  private async createCart(): Promise<string> {
    const data = await this.apiClient.post<any>('orders', { localeCode: 'en_US', channelCode: 'default' });
    return data.tokenValue || data.token;
  }

  /**
   * Add item to cart
   */
  private async addItemToCart(cartToken: string, item: Order['lineItems'][0]): Promise<void> {
    await this.apiClient.post(`orders/${cartToken}/items`, {
      productCode: item.sku || item.productId,
      quantity: item.quantity,
    });
  }

  /**
   * Get an order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Sylius order service not initialized');
    }

    try {
      let data: any;
      try {
        data = await this.apiClient.get<any>(`orders/${orderId}`);
      } catch (e: any) {
        if (e?.status === 404) return null;
        throw e;
      }
      return this.mapToOrder(data);
    } catch (error) {
      this.logger.error(
        { message: `Error fetching order ${orderId} from Sylius` },
        error instanceof Error ? error : new Error(String(error))
      );
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
      await this.apiClient.put(`orders/${orderId}`, { notes: updates.note });
      return await this.getOrder(orderId);
    } catch (error) {
      this.logger.error(
        { message: `Error updating order ${orderId} on Sylius` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
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
