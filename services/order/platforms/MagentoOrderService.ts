/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { MagentoApiClient } from '../../clients/magento/MagentoApiClient';

/**
 * Magento-specific implementation of the order service
 * Supports Magento 2.x REST API
 */
export class MagentoOrderService extends BaseOrderService {
  private apiClient = MagentoApiClient.getInstance();

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
      this.config.apiVersion = this.config.apiVersion || process.env.MAGENTO_API_VERSION || '';

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.storeUrl as string,
          accessToken: this.config.accessToken as string,
          apiVersion: this.config.apiVersion as string,
        });
        await this.apiClient.initialize();
      }

      if (!this.config.storeUrl) {
        this.logger.warn({ message: 'Missing Magento store URL configuration' });
        return false;
      }

      try {
        await this.apiClient.get('orders', { 'searchCriteria[pageSize]': '1' });
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Magento API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Magento order service' },
        error instanceof Error ? error : new Error(String(error))
      );
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
      const cartId = await this.createCart();

      for (const item of order.lineItems) {
        await this.addItemToCart(cartId, item);
      }

      const orderId = await this.apiClient.put<string>(`carts/${cartId}/order`, {
        paymentMethod: { method: 'checkmo' },
      });

      // Fetch the created order
      return (await this.getOrder(String(orderId))) as Order;
    } catch (error) {
      this.logger.error({ message: 'Error creating order on Magento' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Create a cart for order creation
   */
  private async createCart(): Promise<string> {
    return this.apiClient.post<string>('carts', {});
  }

  /**
   * Add item to cart
   */
  private async addItemToCart(cartId: string, item: Order['lineItems'][0]): Promise<void> {
    await this.apiClient.post(`carts/${cartId}/items`, {
      cartItem: { sku: item.sku, qty: item.quantity, quote_id: cartId },
    });
  }

  /**
   * Get an order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Magento order service not initialized');
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
        { message: `Error fetching order ${orderId} from Magento` },
        error instanceof Error ? error : new Error(String(error))
      );
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
      await this.apiClient.post(`orders/${orderId}/comments`, {
        statusHistory: {
          comment: updates.note || 'Order updated from POS',
          is_customer_notified: 0,
          is_visible_on_front: 0,
        },
      });
      return await this.getOrder(orderId);
    } catch (error) {
      this.logger.error(
        { message: `Error updating order ${orderId} on Magento` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
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
