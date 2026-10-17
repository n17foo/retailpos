/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order, TaxQuote } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { WooCommerceApiClient } from '../../../../platform-clients/services/clients/woocommerce/WooCommerceApiClient';

/**
 * WooCommerce-specific implementation of the order service
 */
export class WooCommerceOrderService extends BaseOrderService {
  private apiClient = WooCommerceApiClient.getInstance();

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
      this.config.consumerKey = this.config.consumerKey || process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.WOOCOMMERCE_KEY || '';
      this.config.consumerSecret =
        this.config.consumerSecret || process.env.WOOCOMMERCE_CONSUMER_SECRET || process.env.WOOCOMMERCE_SECRET || '';
      this.config.storeUrl = this.config.storeUrl || process.env.WOOCOMMERCE_URL || '';

      if (!this.config.consumerKey || !this.config.consumerSecret || !this.config.storeUrl) {
        this.logger.warn({ message: 'Missing WooCommerce API configuration' });
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.storeUrl,
          consumerKey: this.config.consumerKey as string,
          consumerSecret: this.config.consumerSecret as string,
          apiVersion: this.config.apiVersion as string,
        });
        await this.apiClient.initialize();
      }

      try {
        await this.apiClient.get('');
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to WooCommerce API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize WooCommerce order service' },
        error instanceof Error ? error : new Error(String(error))
      );
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
   * Create a draft order in WooCommerce.
   * WooCommerce doesn't have a native draft API — we create a 'pending' order
   * which acts as a draft. The server calculates tax based on the line items.
   */
  async createDraftOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce order service not initialized');
    }
    try {
      const wooOrder = this.mapToWooCommerceOrder({ ...order, paymentStatus: 'pending' });
      // Force pending status so it acts as a draft
      wooOrder.status = 'pending';
      wooOrder.set_paid = false;
      const data = await this.apiClient.post<any>('orders', wooOrder);
      return this.mapToOrder(data);
    } catch (error) {
      this.logger.error({ message: 'Error creating WooCommerce draft order' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Ask WooCommerce to calculate tax for the basket.
   * WooCommerce only calculates tax on an order, so a pending order is created, read and deleted straight away.
   * Lines are sent as product + quantity only, so WooCommerce prices them with the store's prices and tax settings
   * (including "prices entered inclusive of tax") instead of trusting a POS-side figure.
   * Docs: https://developer.woocommerce.com/docs/apis/rest-api/v3/orders/ (taxes are calculated on create)
   */
  async quoteTax(order: Order): Promise<TaxQuote> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce order service not initialized');
    }

    const data = await this.apiClient.post<any>('orders', {
      status: 'pending',
      set_paid: false,
      customer_id: 0,
      line_items: order.lineItems.map(item => ({
        product_id: Number(item.productId),
        // A simple product has no variation: the POS variant id then equals the product id
        variation_id: item.variantId && item.variantId !== item.productId ? Number(item.variantId) : undefined,
        quantity: item.quantity,
      })),
    });

    try {
      const net = (data.line_items || []).reduce((sum: number, line: any) => sum + parseFloat(line.total || '0'), 0);
      return { subtotal: net, tax: parseFloat(data.total_tax || '0'), taxIncluded: data.prices_include_tax === true };
    } finally {
      await this.cancelDraftOrder(String(data.id));
    }
  }

  /**
   * Cancel a WooCommerce draft order by deleting it.
   */
  async cancelDraftOrder(platformOrderId: string): Promise<void> {
    if (!this.isInitialized()) return;
    try {
      // WooCommerce: DELETE /orders/{id}?force=true permanently deletes
      await this.apiClient.delete(`orders/${platformOrderId}?force=true`);
    } catch (err) {
      this.logger.warn(
        { message: `Failed to delete WooCommerce draft order ${platformOrderId}` },
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Complete a WooCommerce order (mark as processing/paid).
   */
  async completeOrder(platformOrderId: string, paymentMethod: string, _transactionId?: string): Promise<Order | null> {
    if (!this.isInitialized()) return null;
    try {
      const data = await this.apiClient.put<any>(`orders/${platformOrderId}`, {
        status: 'processing',
        set_paid: true,
        payment_method: paymentMethod,
        payment_method_title: paymentMethod,
      });
      return this.mapToOrder(data);
    } catch (error) {
      this.logger.error(
        { message: `Error completing WooCommerce order ${platformOrderId}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Create a new order in WooCommerce
   */
  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce order service not initialized');
    }

    try {
      const wooOrder = this.mapToWooCommerceOrder(order);
      const data = await this.apiClient.post<any>('orders', wooOrder);
      return this.mapToOrder(data);
    } catch (error) {
      this.logger.error({ message: 'Error creating order on WooCommerce' }, error instanceof Error ? error : new Error(String(error)));
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
        { message: `Error fetching order ${orderId} from WooCommerce` },
        error instanceof Error ? error : new Error(String(error))
      );
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
      const existingOrder = await this.getOrder(orderId);
      if (!existingOrder) {
        throw new Error(`Order with ID ${orderId} not found`);
      }
      const updatedOrder = { ...existingOrder, ...updates };
      const wooOrder = this.mapToWooCommerceOrder(updatedOrder);
      const data = await this.apiClient.put<any>(`orders/${orderId}`, wooOrder);
      return this.mapToOrder(data);
    } catch (error) {
      this.logger.error(
        { message: `Error updating order ${orderId} on WooCommerce` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  // Refund functionality moved to dedicated refund service

  /**
   * Map our order format to WooCommerce's format
   */
  private mapToWooCommerceOrder(order: Order): any {
    const lineItems = order.lineItems.map(item => ({
      product_id: item.productId,
      // A simple product has no variation: the POS variant id then equals the product id
      variation_id: item.variantId && item.variantId !== item.productId ? item.variantId : undefined,
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
}
