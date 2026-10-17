/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { ShopifyApiClient } from '../../../../platform-clients/services/clients/shopify/ShopifyApiClient';

/**
 * Shopify-specific implementation of the order service
 */
export class ShopifyOrderService extends BaseOrderService {
  private apiClient: ShopifyApiClient;

  constructor(config: PlatformOrderConfig = {}) {
    super(config);
    this.apiClient = ShopifyApiClient.getInstance();
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
        this.logger.warn({ message: 'Missing Shopify API configuration' });
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.storeUrl,
          apiKey: this.config.apiKey as string,
          apiSecret: this.config.apiSecret as string,
          accessToken: this.config.accessToken as string,
          apiVersion: this.config.apiVersion as string,
        });
        await this.apiClient.initialize();
      }

      try {
        await this.apiClient.get('shop.json');
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Shopify API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Shopify order service' },
        error instanceof Error ? error : new Error(String(error))
      );
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
   * Create a draft order in Shopify using the Draft Orders API.
   * Shopify calculates tax server-side and returns authoritative totals.
   * Endpoint: POST /admin/api/{version}/draft_orders.json
   */
  async createDraftOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('Shopify order service not initialized');
    }

    try {
      const draftPayload = this.mapToShopifyDraftOrder(order);
      const data = await this.apiClient.post<{ draft_order: any }>('draft_orders.json', { draft_order: draftPayload });
      return this.mapDraftOrderToOrder(data.draft_order);
    } catch (error) {
      this.logger.error({ message: 'Error creating Shopify draft order' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Cancel a Shopify draft order.
   * Endpoint: POST /admin/api/{version}/draft_orders/{id}/complete.json (cancel via delete)
   */
  async cancelDraftOrder(platformOrderId: string): Promise<void> {
    if (!this.isInitialized()) return;
    try {
      await this.apiClient.delete(`draft_orders/${platformOrderId}.json`);
    } catch (err) {
      this.logger.warn(
        { message: `Failed to delete Shopify draft order ${platformOrderId}` },
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Complete a Shopify draft order (mark as paid).
   * Endpoint: PUT /admin/api/{version}/draft_orders/{id}/complete.json
   */
  async completeOrder(platformOrderId: string): Promise<Order | null> {
    if (!this.isInitialized()) return null;
    try {
      const data = await this.apiClient.put<{ draft_order: any }>(`draft_orders/${platformOrderId}/complete.json`, {
        payment_pending: false,
      });
      return this.mapDraftOrderToOrder(data.draft_order);
    } catch (error) {
      this.logger.error(
        { message: `Error completing Shopify draft order ${platformOrderId}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Create a new order in Shopify
   */
  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('Shopify order service not initialized');
    }

    try {
      const shopifyOrder = this.mapToShopifyOrder(order);
      const data = await this.apiClient.post<{ order: any }>('orders.json', { order: shopifyOrder });
      return this.mapToOrder(data.order);
    } catch (error) {
      this.logger.error({ message: 'Error creating Shopify order:' }, error instanceof Error ? error : new Error(String(error)));
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
      let data: { order: any };
      try {
        data = await this.apiClient.get<{ order: any }>(`orders/${orderId}.json`);
      } catch (e: any) {
        if (e?.status === 404) return null;
        throw e;
      }
      return this.mapToOrder(data.order);
    } catch (error) {
      this.logger.error(
        { message: `Error fetching order ${orderId} from Shopify` },
        error instanceof Error ? error : new Error(String(error))
      );
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
      const existingOrder = await this.getOrder(orderId);
      if (!existingOrder) {
        throw new Error(`Order with ID ${orderId} not found`);
      }
      const updatedOrder = { ...existingOrder, ...updates };
      const shopifyOrder = this.mapToShopifyOrder(updatedOrder);
      const data = await this.apiClient.put<{ order: any }>(`orders/${orderId}.json`, { order: shopifyOrder });
      return this.mapToOrder(data.order);
    } catch (error) {
      this.logger.error(
        { message: `Error updating order ${orderId} on Shopify` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  // Refund functionality moved to dedicated refund service

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

  /** Map our Order to Shopify Draft Order payload */
  private mapToShopifyDraftOrder(order: Order): any {
    return {
      line_items: order.lineItems.map(item => ({
        variant_id: item.variantId,
        quantity: item.quantity,
        title: item.name,
        price: item.price.toFixed(2),
        sku: item.sku,
        properties: Object.entries(item.properties || {}).map(([key, value]) => ({ name: key, value })),
      })),
      customer: order.customerEmail ? { email: order.customerEmail } : undefined,
      note: order.note,
      applied_discount: order.discounts?.[0]
        ? {
            value_type: order.discounts[0].type === 'percentage' ? 'percentage' : 'fixed_amount',
            value: String(order.discounts[0].amount),
            title: order.discounts[0].code || 'Discount',
          }
        : undefined,
      use_customer_default_address: false,
    };
  }

  /** Map a Shopify draft_order response to our Order type */
  private mapDraftOrderToOrder(draft: any): Order {
    const lineItems = (draft.line_items || []).map((item: any) => ({
      id: item.id?.toString(),
      productId: item.product_id?.toString() || '',
      variantId: item.variant_id?.toString(),
      sku: item.sku,
      name: item.name || item.title,
      quantity: item.quantity,
      price: parseFloat(item.price || '0'),
      taxRate: item.tax_lines?.[0]?.rate ?? undefined,
      taxAmount: item.tax_lines?.reduce((sum: number, t: any) => sum + parseFloat(t.price || '0'), 0),
      total: parseFloat(item.price || '0') * item.quantity,
    }));

    return {
      id: draft.id?.toString(),
      platformOrderId: draft.id?.toString(),
      customerEmail: draft.customer?.email || draft.email,
      customerName: draft.customer ? `${draft.customer.first_name || ''} ${draft.customer.last_name || ''}`.trim() : undefined,
      lineItems,
      subtotal: parseFloat(draft.subtotal_price || '0'),
      tax: parseFloat(draft.total_tax || '0'),
      total: parseFloat(draft.total_price || '0'),
      paymentStatus: 'draft',
      note: draft.note,
      createdAt: draft.created_at ? new Date(draft.created_at) : undefined,
      updatedAt: draft.updated_at ? new Date(draft.updated_at) : undefined,
    };
  }
}
