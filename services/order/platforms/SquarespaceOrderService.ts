/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { SquarespaceApiClient } from '../../clients/squarespace/SquarespaceApiClient';

/**
 * Squarespace Commerce implementation of the order service
 */
export class SquarespaceOrderService extends BaseOrderService {
  private apiClient = SquarespaceApiClient.getInstance();
  constructor(config: PlatformOrderConfig = {}) {
    super(config);
  }

  async initialize(): Promise<boolean> {
    try {
      this.config.apiKey = this.config.apiKey || process.env.SQUARESPACE_API_KEY || '';
      this.config.siteId = this.config.siteId || process.env.SQUARESPACE_SITE_ID || '';
      if (!this.config.apiKey) {
        this.logger.warn({ message: 'Missing Squarespace API configuration' });
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        await this.apiClient.initialize();
      }

      try {
        await this.apiClient.get('commerce/orders');
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Squarespace API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Squarespace order service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiKey'],
      optional: ['siteId', 'apiVersion'],
      description: 'Squarespace requires an API key',
    };
  }

  async createOrder(_order: Order): Promise<Order> {
    // Squarespace doesn't support order creation via API
    // Orders are created through the Squarespace checkout process
    throw new Error('Squarespace API does not support order creation. Orders must be placed through the Squarespace storefront.');
  }

  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Squarespace order service not initialized');
    }

    try {
      let data: any;
      try {
        data = await this.apiClient.get<any>(`commerce/orders/${orderId}`);
      } catch (e: any) {
        if (e?.status === 404) return null;
        throw e;
      }
      return this.mapToOrder(data);
    } catch (error) {
      this.logger.error(
        { message: `Error fetching order ${orderId} from Squarespace` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Squarespace order service not initialized');
    }

    try {
      if (updates.fulfillmentStatus === 'fulfilled') {
        await this.apiClient.post(`commerce/orders/${orderId}/fulfillments`, {
          shouldSendNotification: true,
          shipments: [{ carrierName: 'Other', trackingNumber: '', shipDate: new Date().toISOString() }],
        });
      }
      return await this.getOrder(orderId);
    } catch (error) {
      this.logger.error(
        { message: `Error updating order ${orderId} on Squarespace` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Get multiple orders with pagination
   */
  async getOrders(cursor?: string): Promise<{ orders: Order[]; nextCursor?: string }> {
    if (!this.isInitialized()) {
      throw new Error('Squarespace order service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>(`commerce/orders${cursor ? `?cursor=${cursor}` : ''}`);
      const orders = (data.result || []).map((o: any) => this.mapToOrder(o));
      return { orders, nextCursor: data.pagination?.nextPageCursor };
    } catch (error) {
      this.logger.error({ message: 'Error fetching orders from Squarespace' }, error instanceof Error ? error : new Error(String(error)));
      return { orders: [] };
    }
  }

  protected mapToOrder(sqOrder: any): Order {
    const lineItems = (sqOrder.lineItems || []).map((item: any) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      name: item.productName,
      quantity: item.quantity,
      price: item.unitPricePaid?.value ? parseFloat(item.unitPricePaid.value) / 100 : 0,
      taxable: true,
      total: item.lineItemTotalPaid?.value ? parseFloat(item.lineItemTotalPaid.value) / 100 : 0,
      properties: item.customizations || {},
    }));

    // Map Squarespace fulfillment status
    let paymentStatus: Order['paymentStatus'] = 'pending';
    let fulfillmentStatus: Order['fulfillmentStatus'] = 'unfulfilled';

    if (sqOrder.fulfillmentStatus === 'FULFILLED') {
      fulfillmentStatus = 'fulfilled';
    } else if (sqOrder.fulfillmentStatus === 'PARTIALLY_FULFILLED') {
      fulfillmentStatus = 'partially_fulfilled';
    }

    // Check payment status from transactions
    if (sqOrder.grandTotal?.value === sqOrder.totalPaid?.value && parseFloat(sqOrder.totalPaid?.value || '0') > 0) {
      paymentStatus = 'paid';
    }
    if (sqOrder.refundedTotal?.value && parseFloat(sqOrder.refundedTotal.value) > 0) {
      paymentStatus = 'refunded';
    }

    const mapAddress = (address: any) => {
      if (!address) return undefined;
      return {
        firstName: address.firstName,
        lastName: address.lastName,
        address1: address.address1,
        address2: address.address2,
        city: address.city,
        province: address.state,
        country: address.countryCode,
        zip: address.postalCode,
        phone: address.phone,
      };
    };

    return {
      id: sqOrder.id,
      platformOrderId: sqOrder.orderNumber,
      customerEmail: sqOrder.customerEmail,
      customerName: sqOrder.billingAddress
        ? `${sqOrder.billingAddress.firstName || ''} ${sqOrder.billingAddress.lastName || ''}`.trim()
        : '',
      lineItems,
      subtotal: sqOrder.subtotal?.value ? parseFloat(sqOrder.subtotal.value) / 100 : 0,
      tax: sqOrder.taxTotal?.value ? parseFloat(sqOrder.taxTotal.value) / 100 : 0,
      total: sqOrder.grandTotal?.value ? parseFloat(sqOrder.grandTotal.value) / 100 : 0,
      shippingAddress: mapAddress(sqOrder.shippingAddress),
      billingAddress: mapAddress(sqOrder.billingAddress),
      paymentStatus,
      fulfillmentStatus,
      createdAt: sqOrder.createdOn ? new Date(sqOrder.createdOn) : undefined,
      updatedAt: sqOrder.modifiedOn ? new Date(sqOrder.modifiedOn) : undefined,
    };
  }
}
