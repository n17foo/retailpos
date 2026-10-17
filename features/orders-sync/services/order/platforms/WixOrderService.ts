/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { WixApiClient } from '../../../../platform-clients/services/clients/wix/WixApiClient';

/**
 * Wix-specific implementation of the order service.
 * Uses Wix eCommerce API v1 (ecom/v1).
 *
 * Basket mode: native_draft
 *   createDraftOrder() → POST ecom/v1/orders/draft-orders
 *   cancelDraftOrder() → POST ecom/v1/orders/draft-orders/{id}/delete
 *   completeOrder()    → POST ecom/v1/orders/draft-orders/{id}/markAsPaid
 *                        then POST ecom/v1/orders/draft-orders/{id}/createOrder
 *
 * Wix explicitly supports "Create Order From Draft" and "Add Payments" for POS flows.
 * Reference: https://dev.wix.com/docs/rest/business-management/orders/ecom-orders/draft-orders
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
        await this.apiClient.post('ecom/v1/orders/search', { search: { paging: { limit: 1 } } });
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

  // ── Draft order lifecycle (native_draft mode) ─────────────────────────────

  /**
   * Create a Wix draft order.
   * Wix returns authoritative tax and totals on the draft.
   * Endpoint: POST ecom/v1/orders/draft-orders
   */
  async createDraftOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('Wix order service not initialized');
    }
    try {
      const payload = {
        lineItems: order.lineItems.map(item => ({
          catalogReference: {
            catalogItemId: item.productId,
            appId: '1380b703-ce81-ff05-f115-39571d94dfcd', // Wix Stores app ID
            options: item.variantId ? { variantId: item.variantId } : undefined,
          },
          quantity: item.quantity,
        })),
        buyerInfo: { email: order.customerEmail },
        buyerNote: order.note,
        channelInfo: { type: 'POS' },
        discountCodes: order.discounts?.map(d => d.code).filter(Boolean) as string[] | undefined,
      };
      const data = await this.apiClient.post<any>('ecom/v1/orders/draft-orders', { draftOrder: payload });
      return this.mapDraftToOrder(data.draftOrder);
    } catch (error) {
      this.logger.error({ message: 'Error creating Wix draft order' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Cancel (delete) a Wix draft order before payment.
   * Endpoint: POST ecom/v1/orders/draft-orders/{id}/delete
   */
  async cancelDraftOrder(platformOrderId: string): Promise<void> {
    if (!this.isInitialized()) return;
    try {
      await this.apiClient.post(`ecom/v1/orders/draft-orders/${platformOrderId}/delete`, {});
    } catch (err) {
      this.logger.warn(
        { message: `Failed to delete Wix draft order ${platformOrderId}` },
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Complete a Wix draft order after payment.
   * Step 1: mark draft as paid (records payment)
   * Step 2: create live order from draft
   * Endpoints: POST ecom/v1/orders/draft-orders/{id}/markAsPaid
   *            POST ecom/v1/orders/draft-orders/{id}/createOrder
   */
  async completeOrder(platformOrderId: string, paymentMethod: string, _transactionId?: string): Promise<Order | null> {
    if (!this.isInitialized()) return null;
    try {
      await this.apiClient.post(`ecom/v1/orders/draft-orders/${platformOrderId}/markAsPaid`, {
        payments: [{ regularPaymentDetails: { paymentMethod } }],
      });
      const data = await this.apiClient.post<any>(`ecom/v1/orders/draft-orders/${platformOrderId}/createOrder`, {});
      return this.mapToOrder(data.order);
    } catch (error) {
      this.logger.error(
        { message: `Error completing Wix draft order ${platformOrderId}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  // ── Standard order operations ─────────────────────────────────────────────

  /**
   * Create a Wix order directly (used by sync for orders without a draft).
   * Endpoint: POST ecom/v1/orders
   */
  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('Wix order service not initialized');
    }
    try {
      const wixOrder = this.mapToWixOrder(order);
      const data = await this.apiClient.post<any>('ecom/v1/orders', { order: wixOrder });
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
        data = await this.apiClient.get<any>(`ecom/v1/orders/${orderId}`);
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
      await this.apiClient.patch(`ecom/v1/orders/${orderId}`, { order: { buyerNote: updates.note } });
      return await this.getOrder(orderId);
    } catch (error) {
      this.logger.error({ message: `Error updating order ${orderId} on Wix` }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  // ── Mapping helpers ───────────────────────────────────────────────────────

  private mapToWixOrder(order: Order): any {
    return {
      lineItems: order.lineItems.map(item => ({
        catalogReference: {
          catalogItemId: item.productId,
          appId: '1380b703-ce81-ff05-f115-39571d94dfcd',
          options: item.variantId ? { variantId: item.variantId } : undefined,
        },
        quantity: item.quantity,
        priceData: { price: item.price },
      })),
      buyerInfo: { email: order.customerEmail },
      buyerNote: order.note,
      channelInfo: { type: 'POS' },
      paymentStatus: order.paymentStatus === 'paid' ? 'PAID' : 'PENDING',
    };
  }

  /**
   * Map a Wix draft order response to our Order shape.
   * Draft orders use a slightly different shape than live orders.
   */
  private mapDraftToOrder(draft: any): Order {
    const lineItems = (draft.lineItems || []).map((item: any) => ({
      id: item.id,
      productId: item.catalogReference?.catalogItemId || '',
      variantId: item.catalogReference?.options?.variantId,
      sku: item.physicalProperties?.sku,
      name: item.productName?.original || item.name || '',
      quantity: item.quantity,
      price: item.priceData?.price || 0,
      // `taxInfo` replaces the deprecated `taxDetails` (removed by Wix on 2024-09-30)
      taxRate: item.taxInfo?.taxRate != null ? parseFloat(item.taxInfo.taxRate) : undefined,
      taxAmount: item.taxInfo?.taxAmount?.amount != null ? parseFloat(item.taxInfo.taxAmount.amount) : undefined,
      total: item.priceData?.totalPrice || 0,
      properties: {},
    }));

    return {
      id: draft.id,
      platformOrderId: draft.id,
      customerEmail: draft.buyerInfo?.email,
      customerName: `${draft.buyerInfo?.firstName || ''} ${draft.buyerInfo?.lastName || ''}`.trim(),
      lineItems,
      subtotal: draft.priceSummary?.subtotal?.amount ? parseFloat(draft.priceSummary.subtotal.amount) : 0,
      tax: draft.priceSummary?.tax?.amount ? parseFloat(draft.priceSummary.tax.amount) : 0,
      total: draft.priceSummary?.total?.amount ? parseFloat(draft.priceSummary.total.amount) : 0,
      paymentStatus: 'draft',
      note: draft.buyerNote,
      createdAt: draft.createdDate ? new Date(draft.createdDate) : undefined,
      updatedAt: draft.updatedDate ? new Date(draft.updatedDate) : undefined,
    };
  }

  protected mapToOrder(wixOrder: any): Order {
    const lineItems = (wixOrder.lineItems || []).map((item: any) => ({
      id: item.id,
      productId: item.catalogReference?.catalogItemId || item.productId,
      variantId: item.catalogReference?.options?.variantId,
      sku: item.physicalProperties?.sku || item.sku,
      name: item.productName?.original || item.name || '',
      quantity: item.quantity,
      price: item.priceData?.price || item.price || 0,
      total: item.priceData?.totalPrice || item.totalPrice || 0,
      properties: {},
    }));

    let paymentStatus: Order['paymentStatus'] = 'pending';
    let fulfillmentStatus: Order['fulfillmentStatus'] = 'unfulfilled';

    if (wixOrder.paymentStatus === 'PAID') paymentStatus = 'paid';
    else if (wixOrder.paymentStatus === 'REFUNDED') paymentStatus = 'refunded';

    if (wixOrder.fulfillmentStatus === 'FULFILLED') fulfillmentStatus = 'fulfilled';
    else if (wixOrder.fulfillmentStatus === 'PARTIALLY_FULFILLED') fulfillmentStatus = 'partially_fulfilled';

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
      subtotal: wixOrder.priceSummary?.subtotal?.amount ? parseFloat(wixOrder.priceSummary.subtotal.amount) : 0,
      tax: wixOrder.priceSummary?.tax?.amount ? parseFloat(wixOrder.priceSummary.tax.amount) : 0,
      total: wixOrder.priceSummary?.total?.amount ? parseFloat(wixOrder.priceSummary.total.amount) : 0,
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
