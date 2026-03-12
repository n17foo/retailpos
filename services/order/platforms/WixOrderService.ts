/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { WixApiClient } from '../../clients/wix/WixApiClient';

/**
 * Wix-specific implementation of the order service
 * Uses Wix Stores API
 */
export class WixOrderService extends BaseOrderService {
  private apiClient = WixApiClient.getInstance();
  constructor(config: PlatformOrderConfig = {}) {
    super(config);
  }

  async initialize(): Promise<boolean> {
    try {
      this.config.apiKey = this.config.apiKey || process.env.WIX_API_KEY || '';
      this.config.siteId = this.config.siteId || process.env.WIX_SITE_ID || '';
      this.config.accountId = this.config.accountId || process.env.WIX_ACCOUNT_ID || '';
      if (!this.config.apiKey || !this.config.siteId) {
        this.logger.warn({ message: 'Missing Wix API configuration' });
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ siteId: this.config.siteId as string });
        await this.apiClient.initialize();
      }

      try {
        await this.apiClient.post('stores/v2/orders/query', { query: { paging: { limit: 1 } } });
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Wix API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error({ message: 'Failed to initialize Wix order service' }, error instanceof Error ? error : new Error(String(error)));
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
      const wixOrder = this.mapToWixOrder(order);
      const data = await this.apiClient.post<any>('stores/v2/orders', { order: wixOrder });
      return this.mapToOrder(data.order);
    } catch (error) {
      this.logger.error({ message: 'Error creating order on Wix' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Wix order service not initialized');
    }

    try {
      let data: any;
      try {
        data = await this.apiClient.get<any>(`stores/v2/orders/${orderId}`);
      } catch (e: any) {
        if (e?.status === 404) return null;
        throw e;
      }
      return this.mapToOrder(data.order);
    } catch (error) {
      this.logger.error({ message: `Error fetching order ${orderId} from Wix` }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Wix order service not initialized');
    }

    try {
      await this.apiClient.put(`stores/v2/orders/${orderId}`, { order: { buyerNote: updates.note } });
      return await this.getOrder(orderId);
    } catch (error) {
      this.logger.error({ message: `Error updating order ${orderId} on Wix` }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
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
