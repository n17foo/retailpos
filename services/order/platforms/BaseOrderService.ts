/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order, TaxQuote } from '../OrderServiceInterface';
import { PlatformOrderServiceInterface, PlatformConfigRequirements, PlatformOrderConfig } from './PlatformOrderServiceInterface';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * Base abstract class for platform-specific order service implementations.
 *
 * Draft order lifecycle:
 *   createDraftOrder() — creates a draft with platform-calculated tax (override per platform)
 *   cancelDraftOrder() — cancels/deletes the draft before payment (override per platform)
 *   completeOrder()    — marks the draft as paid after payment (override per platform)
 *
 * Default implementations fall back to createOrder() for platforms that don't
 * natively support drafts, so existing services keep working without changes.
 */
export abstract class BaseOrderService implements PlatformOrderServiceInterface {
  protected initialized: boolean = false;
  protected config: PlatformOrderConfig;
  protected logger = LoggerFactory.getInstance().createLogger(this.constructor.name);

  constructor(config: PlatformOrderConfig = {}) {
    this.config = config;
  }

  abstract initialize(): Promise<boolean>;

  isInitialized(): boolean {
    return this.initialized;
  }

  abstract getConfigRequirements(): PlatformConfigRequirements;
  abstract createOrder(order: Order): Promise<Order>;
  abstract getOrder(orderId: string): Promise<Order | null>;
  abstract updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null>;

  // ── Draft order lifecycle ─────────────────────────────────────────────
  // Platforms override these to use native draft APIs.
  // Default: createDraftOrder falls back to createOrder (no native draft support).

  async createDraftOrder(order: Order): Promise<Order> {
    return this.createOrder({ ...order, paymentStatus: 'draft' });
  }

  /**
   * Platform-calculated tax for a basket. Platforms that can return it override this; the default
   * refuses so a sale is never priced with a tax figure the platform did not provide.
   */
  async quoteTax(_order: Order): Promise<TaxQuote> {
    throw new Error(`${this.constructor.name} cannot calculate tax`);
  }

  async cancelDraftOrder(platformOrderId: string): Promise<void> {
    try {
      await this.updateOrder(platformOrderId, { paymentStatus: 'failed' });
    } catch (err) {
      this.logger.warn(
        { message: `cancelDraftOrder fallback failed for ${platformOrderId}` },
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  async completeOrder(platformOrderId: string, paymentMethod: string, _transactionId?: string): Promise<Order | null> {
    return this.updateOrder(platformOrderId, {
      paymentStatus: 'paid',
      note: paymentMethod,
    });
  }

  // ── Shared mapping helpers ────────────────────────────────────────────

  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  protected mapToOrder(platformOrder: any): Order {
    const lineItems =
      platformOrder.line_items?.map((item: any) => ({
        id: item.id?.toString(),
        productId: item.product_id?.toString() || '',
        variantId: item.variant_id?.toString(),
        sku: item.sku,
        name: item.name || item.title || '',
        quantity: item.quantity || 0,
        price: parseFloat(item.price || '0'),
        taxRate: item.tax_rate ? parseFloat(item.tax_rate) : undefined,
        taxAmount: item.tax_amount ? parseFloat(item.tax_amount) : undefined,
        discountAmount: item.discount_amount ? parseFloat(item.discount_amount) : undefined,
        total: parseFloat(item.total || item.price * item.quantity || '0'),
        properties: item.properties || {},
      })) || [];

    const discounts =
      platformOrder.discounts?.map((discount: any) => ({
        code: discount.code,
        amount: parseFloat(discount.amount || '0'),
        type: discount.type || 'fixed_amount',
        description: discount.description || discount.title || '',
      })) || [];

    const mapAddress = (address: any) => {
      if (!address) return undefined;
      return {
        firstName: address.first_name || address.firstName,
        lastName: address.last_name || address.lastName,
        company: address.company,
        address1: address.address1 || address.address_1,
        address2: address.address2 || address.address_2,
        city: address.city,
        province: address.province || address.state,
        provinceCode: address.province_code || address.state_code,
        country: address.country,
        countryCode: address.country_code,
        zip: address.zip || address.postal_code,
        phone: address.phone,
      };
    };

    return {
      id: platformOrder.id?.toString(),
      platformOrderId: platformOrder.platform_order_id || platformOrder.platformOrderId || platformOrder.id?.toString(),
      customerEmail: platformOrder.customer_email || platformOrder.customerEmail || platformOrder.email,
      customerName: platformOrder.customer_name || platformOrder.customerName || platformOrder.name,
      lineItems,
      subtotal: parseFloat(platformOrder.subtotal || '0'),
      tax: parseFloat(platformOrder.tax || platformOrder.total_tax || '0'),
      total: parseFloat(platformOrder.total || '0'),
      discounts,
      shippingAddress: mapAddress(platformOrder.shipping_address || platformOrder.shippingAddress),
      billingAddress: mapAddress(platformOrder.billing_address || platformOrder.billingAddress),
      paymentStatus: platformOrder.payment_status || platformOrder.paymentStatus || 'pending',
      fulfillmentStatus: platformOrder.fulfillment_status || platformOrder.fulfillmentStatus || 'unfulfilled',
      note: platformOrder.note || platformOrder.customer_note,
      tags: platformOrder.tags ? (typeof platformOrder.tags === 'string' ? platformOrder.tags.split(',') : platformOrder.tags) : [],
      createdAt: platformOrder.created_at
        ? new Date(platformOrder.created_at)
        : platformOrder.createdAt
          ? new Date(platformOrder.createdAt)
          : undefined,
      updatedAt: platformOrder.updated_at
        ? new Date(platformOrder.updated_at)
        : platformOrder.updatedAt
          ? new Date(platformOrder.updatedAt)
          : undefined,
    };
  }
}
