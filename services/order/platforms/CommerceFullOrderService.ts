/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order, OrderLineItem } from '../OrderServiceInterface';
import { PlatformOrderServiceInterface, PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { CommerceFullApiClient, CommerceFullConfig } from '../../clients/commercefull/CommerceFullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * CommerceFull platform implementation of the order service.
 *
 * Endpoint mapping:
 *   POST /customer/order              → createOrder
 *   GET  /business/orders/:orderId    → getOrder
 *   PUT  /business/orders/:id/status  → updateOrder (status update)
 */
export class CommerceFullOrderService implements PlatformOrderServiceInterface {
  private config: PlatformOrderConfig;
  private initialized = false;
  private apiClient: CommerceFullApiClient;
  private logger = LoggerFactory.getInstance().createLogger('CommerceFullOrderService');

  constructor(config: PlatformOrderConfig = {}) {
    this.config = config;
    this.apiClient = CommerceFullApiClient.getInstance();
  }

  async initialize(): Promise<boolean> {
    try {
      const clientConfig: CommerceFullConfig = {
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
        { message: 'Failed to initialize CommerceFull order service' },
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
      description: 'CommerceFull order service requires store URL and API credentials',
    };
  }

  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull order service not initialized');
    }

    try {
      const body = this.mapToCommerceFullOrder(order);
      const data = await this.apiClient.post<any>('/customer/order', body);
      return this.mapToOrder(data.data || data.order || data);
    } catch (error) {
      this.logger.error({ message: 'Error creating order on CommerceFull' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull order service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>(`/business/orders/${orderId}`);
      return this.mapToOrder(data.data || data.order || data);
    } catch (error) {
      this.logger.error(
        { message: `Error fetching order ${orderId} from CommerceFull` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull order service not initialized');
    }

    try {
      // CommerceFull supports status updates via PUT /business/orders/:id/status
      const body: Record<string, unknown> = {};
      if (updates.paymentStatus) body.paymentStatus = updates.paymentStatus;
      if (updates.fulfillmentStatus) body.fulfillmentStatus = updates.fulfillmentStatus;
      if (updates.note) body.note = updates.note;

      const data = await this.apiClient.put<any>(`/business/orders/${orderId}/status`, body);
      return this.mapToOrder(data.data || data.order || data);
    } catch (error) {
      this.logger.error(
        { message: `Error updating order ${orderId} on CommerceFull` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  private mapToOrder(o: any): Order {
    if (!o) return { lineItems: [], subtotal: 0, tax: 0, total: 0 };

    const lineItems: OrderLineItem[] = (o.items || o.lineItems || []).map((item: any) => ({
      id: String(item.orderItemId || item.id || ''),
      productId: String(item.productId || ''),
      variantId: item.variantId ? String(item.variantId) : undefined,
      sku: item.sku || '',
      name: item.name || item.productName || '',
      quantity: item.quantity || 0,
      price: parseFloat(item.price || item.unitPrice) || 0,
      taxable: item.taxable ?? true,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      discountAmount: item.discountAmount,
      total: parseFloat(item.total || item.lineTotal) || 0,
    }));

    return {
      id: String(o.orderId || o.id || ''),
      platformOrderId: String(o.orderId || o.id || ''),
      customerEmail: o.customerEmail || o.email || '',
      customerName: o.customerName || [o.firstName, o.lastName].filter(Boolean).join(' ') || '',
      lineItems,
      subtotal: parseFloat(o.subtotal) || 0,
      tax: parseFloat(o.taxTotal || o.tax) || 0,
      total: parseFloat(o.total || o.grandTotal) || 0,
      discounts: o.discounts,
      paymentStatus: o.paymentStatus || 'pending',
      fulfillmentStatus: o.fulfillmentStatus || 'unfulfilled',
      note: o.note || o.notes || '',
      tags: o.tags || [],
      createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
      updatedAt: o.updatedAt ? new Date(o.updatedAt) : undefined,
    };
  }

  private mapToCommerceFullOrder(order: Order): Record<string, unknown> {
    return {
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      items: order.lineItems.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        taxable: item.taxable,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        discountAmount: item.discountAmount,
        total: item.total,
      })),
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      discounts: order.discounts,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      note: order.note,
      tags: order.tags,
    };
  }
}
