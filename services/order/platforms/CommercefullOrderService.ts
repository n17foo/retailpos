/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order, OrderLineItem, Address } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { CommercefullApiClient, CommercefullConfig } from '../../clients/commercefull/CommercefullApiClient';
import { toCents, toDollars } from '../../../utils/money';

/**
 * Commercefull platform implementation of the order service.
 *
 * Endpoint mapping:
 *   POST /business/orders                            → createOrder (POS/back-office orders)
 *   GET  /business/orders/:orderId                   → getOrder
 *   PUT  /business/orders/:id/payment-status         → payment status update
 *   PUT  /business/orders/:id/fulfillment-status     → fulfillment status update
 *   POST /business/orders/:id/notes                  → order note
 *
 * All monetary fields on the platform are integer cents (*Cents).
 */
export class CommercefullOrderService extends BaseOrderService {
  private apiClient: CommercefullApiClient;

  constructor(config: PlatformOrderConfig = {}) {
    super(config);
    this.apiClient = CommercefullApiClient.getInstance();
  }

  async initialize(): Promise<boolean> {
    try {
      const clientConfig: CommercefullConfig = {
        storeUrl: this.config.storeUrl,
        apiKey: this.config.apiKey,
        apiSecret: this.config.apiSecret,
        apiVersion: this.config.apiVersion,
      };

      this.apiClient.configure(clientConfig);
      const ok = await this.apiClient.initialize();
      if (ok) this.initialized = true;
      return ok;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Commercefull order service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey', 'apiSecret'],
      optional: ['apiVersion'],
      description: 'Commercefull order service requires store URL and API credentials',
    };
  }

  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull order service not initialized');
    }

    try {
      const body = this.mapToCommercefullOrder(order);
      const data = await this.apiClient.post<any>('/business/orders', body);
      const created = data?.data || data;

      // Apply requested statuses via the dedicated status endpoints. Newly
      // created orders start as pending/unfulfilled, so only non-default
      // values need an extra call. Failures are non-fatal: the order exists.
      const paymentStatus = this.mapPaymentStatusToPlatform(order.paymentStatus);
      if (paymentStatus && paymentStatus !== 'pending') {
        try {
          await this.apiClient.put<any>(`/business/orders/${created.orderId}/payment-status`, { paymentStatus });
        } catch (error) {
          this.logger.warn(
            { message: `Failed to set payment status ${paymentStatus} on order ${created.orderId}` },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      const fulfillmentStatus = this.mapFulfillmentStatusToPlatform(order.fulfillmentStatus);
      if (fulfillmentStatus && fulfillmentStatus !== 'unfulfilled') {
        try {
          await this.apiClient.put<any>(`/business/orders/${created.orderId}/fulfillment-status`, { fulfillmentStatus });
        } catch (error) {
          this.logger.warn(
            { message: `Failed to set fulfillment status ${fulfillmentStatus} on order ${created.orderId}` },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      const fetched = await this.getOrder(String(created.orderId || ''));
      return fetched || this.mapToOrder(created);
    } catch (error) {
      this.logger.error({ message: 'Error creating order on Commercefull' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull order service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>(`/business/orders/${orderId}`);
      return this.mapToOrder(data?.data || data?.order || data);
    } catch (error) {
      this.logger.error(
        { message: `Error fetching order ${orderId} from Commercefull` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull order service not initialized');
    }

    try {
      const paymentStatus = this.mapPaymentStatusToPlatform(updates.paymentStatus);
      if (paymentStatus) {
        await this.apiClient.put<any>(`/business/orders/${orderId}/payment-status`, { paymentStatus });
      }

      const fulfillmentStatus = this.mapFulfillmentStatusToPlatform(updates.fulfillmentStatus);
      if (fulfillmentStatus) {
        await this.apiClient.put<any>(`/business/orders/${orderId}/fulfillment-status`, { fulfillmentStatus });
      }

      if (updates.note) {
        await this.apiClient.post<any>(`/business/orders/${orderId}/notes`, {
          content: updates.note,
          isCustomerVisible: false,
        });
      }

      return this.getOrder(orderId);
    } catch (error) {
      this.logger.error(
        { message: `Error updating order ${orderId} on Commercefull` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  protected mapToOrder(o: any): Order {
    if (!o) return { lineItems: [], subtotal: 0, tax: 0, total: 0 };

    const lineItems: OrderLineItem[] = (o.items || o.lineItems || []).map((item: any) => ({
      id: String(item.orderItemId || item.id || ''),
      productId: String(item.productId || ''),
      variantId: item.productVariantId || item.variantId ? String(item.productVariantId || item.variantId) : undefined,
      sku: item.sku || '',
      name: item.name || item.productName || '',
      quantity: item.quantity || 0,
      price: toDollars(item.unitPriceCents) || 0,
      taxRate: item.taxRate,
      taxAmount: item.taxTotalCents != null ? toDollars(item.taxTotalCents) : undefined,
      discountAmount: item.discountTotalCents != null ? toDollars(item.discountTotalCents) : undefined,
      total: toDollars(item.lineTotalCents) || 0,
      properties: item.attributes,
    }));

    return {
      id: String(o.orderId || o.id || ''),
      platformOrderId: String(o.orderId || o.id || ''),
      customerEmail: o.customerEmail || '',
      customerName: o.customerName || '',
      lineItems,
      subtotal: toDollars(o.subtotalCents) || 0,
      tax: toDollars(o.taxTotalCents) || 0,
      total: toDollars(o.totalAmountCents) || 0,
      discounts: o.discounts,
      shippingAddress: this.mapAddress(o.shippingAddress),
      billingAddress: this.mapAddress(o.billingAddress),
      paymentStatus: this.mapPaymentStatusFromPlatform(o.paymentStatus),
      fulfillmentStatus: this.mapFulfillmentStatusFromPlatform(o.fulfillmentStatus),
      note: o.customerNotes || o.note || o.notes || '',
      tags: o.tags || [],
      createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
      updatedAt: o.updatedAt ? new Date(o.updatedAt) : undefined,
    };
  }

  private mapToCommercefullOrder(order: Order): Record<string, unknown> {
    return {
      customerEmail: order.customerEmail || undefined,
      customerName: order.customerName || undefined,
      customerNotes: order.note || undefined,
      orderSource: 'pos',
      items: order.lineItems.map(item => ({
        productId: item.productId,
        productVariantId: item.variantId || undefined,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: toCents(item.price),
        taxRate: item.taxRate,
        attributes: item.properties,
      })),
      shippingAddress: this.mapAddressToPlatform(order.shippingAddress),
      billingAddress: this.mapAddressToPlatform(order.billingAddress),
      metadata: {
        discounts: order.discounts,
        tags: order.tags,
      },
    };
  }

  private mapAddress(a: any): Address | undefined {
    if (!a) return undefined;
    return {
      firstName: a.firstName || '',
      lastName: a.lastName || '',
      company: a.company,
      address1: a.address1 || '',
      address2: a.address2,
      city: a.city || '',
      province: a.state || '',
      provinceCode: a.state,
      country: a.country || '',
      countryCode: a.countryCode || '',
      zip: a.postalCode || '',
      phone: a.phone,
    };
  }

  private mapAddressToPlatform(a?: Address): Record<string, unknown> | undefined {
    if (!a) return undefined;
    return {
      firstName: a.firstName || '',
      lastName: a.lastName || '',
      company: a.company,
      address1: a.address1 || '',
      address2: a.address2,
      city: a.city || '',
      state: a.province || '',
      postalCode: a.zip || '',
      country: a.country || '',
      countryCode: a.countryCode || '',
      phone: a.phone,
    };
  }

  /** POS ('pending' | 'paid' | 'partially_refunded' | …) → platform enum values */
  private mapPaymentStatusToPlatform(status?: string): string | undefined {
    switch (status) {
      case 'draft':
      case 'pending':
        return 'pending';
      case 'paid':
        return 'paid';
      case 'partially_refunded':
        return 'partiallyRefunded';
      case 'refunded':
        return 'refunded';
      case 'failed':
        return 'failed';
      default:
        return undefined;
    }
  }

  private mapPaymentStatusFromPlatform(status?: string): Order['paymentStatus'] {
    switch (status) {
      case 'paid':
        return 'paid';
      case 'partiallyRefunded':
        return 'partially_refunded';
      case 'refunded':
        return 'refunded';
      case 'failed':
      case 'voided':
        return 'failed';
      default:
        return 'pending';
    }
  }

  /** POS ('unfulfilled' | 'partially_fulfilled' | 'fulfilled') → platform enum values */
  private mapFulfillmentStatusToPlatform(status?: string): string | undefined {
    switch (status) {
      case 'unfulfilled':
        return 'unfulfilled';
      case 'partially_fulfilled':
        return 'partiallyFulfilled';
      case 'fulfilled':
        return 'fulfilled';
      default:
        return undefined;
    }
  }

  private mapFulfillmentStatusFromPlatform(status?: string): Order['fulfillmentStatus'] {
    switch (status) {
      case 'partiallyFulfilled':
        return 'partially_fulfilled';
      case 'fulfilled':
      case 'shipped':
      case 'delivered':
      case 'pendingPickup':
      case 'pickedUp':
        return 'fulfilled';
      default:
        return 'unfulfilled';
    }
  }
}
