import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { WIX_API_VERSION } from '../../config/ServiceConfigBridge';
import { QueuedApiService } from '../../queue/QueuedApiService';

/**
 * Wix-specific implementation of the order service
 * Uses Wix Stores API
 */
export class WixOrderService extends BaseOrderService {
  constructor(config: PlatformOrderConfig = {}) {
    super(config);
  }

  async initialize(): Promise<boolean> {
    try {
      this.config.apiKey = this.config.apiKey || process.env.WIX_API_KEY || '';
      this.config.siteId = this.config.siteId || process.env.WIX_SITE_ID || '';
      this.config.accountId = this.config.accountId || process.env.WIX_ACCOUNT_ID || '';
      this.config.apiVersion = this.config.apiVersion || process.env.WIX_API_VERSION || WIX_API_VERSION;

      if (!this.config.apiKey || !this.config.siteId) {
        console.warn('Missing Wix API configuration');
        return false;
      }

      // Test connection
      try {
        const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/orders/query`;
        const response = await QueuedApiService.directRequestWithBody(
          apiUrl,
          'POST',
          { query: { paging: { limit: 1 } } },
          this.getAuthHeaders()
        );

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to Wix API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to Wix API', error);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize Wix order service', error);
      return false;
    }
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiKey', 'siteId'],
      optional: ['accountId', 'apiVersion'],
      description: 'Wix requires API key and site ID',
    };
  }

  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('Wix order service not initialized');
    }

    try {
      const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/orders`;

      const wixOrder = this.mapToWixOrder(order);

      // Use QueuedApiService for API call with X-Request-ID for idempotency
      const requestId = `wix_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response = await QueuedApiService.directRequestWithBody(
        apiUrl,
        'POST',
        { order: wixOrder },
        {
          ...this.getAuthHeaders(),
          'X-Request-ID': requestId,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create order on Wix: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapToOrder(data.order);
    } catch (error) {
      console.error('Error creating order on Wix', error);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Wix order service not initialized');
    }

    try {
      const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/orders/${orderId}`;

      const response = await QueuedApiService.directRequest(apiUrl, 'GET', this.getAuthHeaders());

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch order from Wix: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapToOrder(data.order);
    } catch (error) {
      console.error(`Error fetching order ${orderId} from Wix`, error);
      return null;
    }
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Wix order service not initialized');
    }

    try {
      // Wix has limited order update - mainly fulfillment status
      const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/orders/${orderId}`;

      const response = await QueuedApiService.directRequestWithBody(
        apiUrl,
        'PATCH',
        {
          order: {
            buyerNote: updates.note,
          },
        },
        this.getAuthHeaders()
      );

      if (!response.ok) {
        throw new Error(`Failed to update order on Wix: ${response.statusText}`);
      }

      return await this.getOrder(orderId);
    } catch (error) {
      console.error(`Error updating order ${orderId} on Wix`, error);
      return null;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: this.config.apiKey as string,
      'wix-site-id': this.config.siteId as string,
      'Content-Type': 'application/json',
    };
  }

  private mapToWixOrder(order: Order): any {
    return {
      lineItems: order.lineItems.map(item => ({
        catalogReference: {
          catalogItemId: item.productId,
          appId: '1380b703-ce81-ff05-f115-39571d94dfcd', // Wix Stores app ID
        },
        quantity: item.quantity,
        priceData: {
          price: item.price,
        },
      })),
      buyerInfo: {
        email: order.customerEmail,
      },
      buyerNote: order.note,
      channelInfo: {
        type: 'POS',
      },
    };
  }

  protected mapToOrder(wixOrder: any): Order {
    const lineItems = (wixOrder.lineItems || []).map((item: any) => ({
      id: item.id,
      productId: item.catalogReference?.catalogItemId || item.productId,
      variantId: item.catalogReference?.options?.variantId,
      sku: item.sku,
      name: item.name || item.productName?.original || '',
      quantity: item.quantity,
      price: item.priceData?.price || item.price || 0,
      taxable: true,
      total: item.priceData?.totalPrice || item.totalPrice || 0,
      properties: {},
    }));

    let paymentStatus: Order['paymentStatus'] = 'pending';
    let fulfillmentStatus: Order['fulfillmentStatus'] = 'unfulfilled';

    if (wixOrder.paymentStatus === 'PAID') {
      paymentStatus = 'paid';
    } else if (wixOrder.paymentStatus === 'REFUNDED') {
      paymentStatus = 'refunded';
    }

    if (wixOrder.fulfillmentStatus === 'FULFILLED') {
      fulfillmentStatus = 'fulfilled';
    } else if (wixOrder.fulfillmentStatus === 'PARTIALLY_FULFILLED') {
      fulfillmentStatus = 'partially_fulfilled';
    }

    const mapAddress = (address: any) => {
      if (!address) return undefined;
      return {
        firstName: address.fullName?.firstName,
        lastName: address.fullName?.lastName,
        company: address.company,
        address1: address.addressLine1 || address.address?.addressLine,
        address2: address.addressLine2,
        city: address.city,
        province: address.subdivision,
        country: address.country,
        zip: address.postalCode,
        phone: address.phone,
      };
    };

    return {
      id: wixOrder.id,
      platformOrderId: wixOrder.number?.toString(),
      customerEmail: wixOrder.buyerInfo?.email,
      customerName: `${wixOrder.buyerInfo?.firstName || ''} ${wixOrder.buyerInfo?.lastName || ''}`.trim(),
      lineItems,
      subtotal: wixOrder.priceSummary?.subtotal?.amount || 0,
      tax: wixOrder.priceSummary?.tax?.amount || 0,
      total: wixOrder.priceSummary?.total?.amount || 0,
      shippingAddress: mapAddress(wixOrder.shippingInfo?.logistics?.shippingDestination?.address),
      billingAddress: mapAddress(wixOrder.billingInfo?.address),
      paymentStatus,
      fulfillmentStatus,
      note: wixOrder.buyerNote,
      createdAt: wixOrder.createdDate ? new Date(wixOrder.createdDate) : undefined,
      updatedAt: wixOrder.updatedDate ? new Date(wixOrder.updatedDate) : undefined,
    };
  }
}
