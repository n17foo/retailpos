import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { createBasicAuthHeader } from '../../../utils/base64';

/**
 * PrestaShop-specific implementation of the order service
 */
export class PrestaShopOrderService extends BaseOrderService {
  constructor(config: PlatformOrderConfig = {}) {
    super(config);
  }

  async initialize(): Promise<boolean> {
    try {
      this.config.storeUrl = this.config.storeUrl || process.env.PRESTASHOP_STORE_URL || '';
      this.config.apiKey = this.config.apiKey || process.env.PRESTASHOP_API_KEY || '';

      if (this.config.storeUrl) {
        this.config.storeUrl = this.normalizeUrl(this.config.storeUrl);
      }

      if (!this.config.storeUrl || !this.config.apiKey) {
        console.warn('Missing PrestaShop API configuration');
        return false;
      }

      // Test connection
      try {
        const apiUrl = `${this.config.storeUrl}/api/orders?output_format=JSON&limit=1`;
        const response = await fetch(apiUrl, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to PrestaShop API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to PrestaShop API', error);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize PrestaShop order service', error);
      return false;
    }
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey'],
      optional: [],
      description: 'PrestaShop requires store URL and API key',
    };
  }

  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop order service not initialized');
    }

    try {
      const apiUrl = `${this.config.storeUrl}/api/orders?output_format=JSON`;
      const psOrder = this.mapToPrestaShopOrder(order);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order: psOrder }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create order on PrestaShop: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapToOrder(data.order);
    } catch (error) {
      console.error('Error creating order on PrestaShop', error);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop order service not initialized');
    }

    try {
      const apiUrl = `${this.config.storeUrl}/api/orders/${orderId}?output_format=JSON&display=full`;

      const response = await fetch(apiUrl, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch order from PrestaShop: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapToOrder(data.order);
    } catch (error) {
      console.error(`Error fetching order ${orderId} from PrestaShop`, error);
      return null;
    }
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop order service not initialized');
    }

    try {
      const apiUrl = `${this.config.storeUrl}/api/orders/${orderId}?output_format=JSON`;

      // PrestaShop order updates are limited - mainly status changes
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: {
            current_state: this.mapStatusToPrestaShop(updates.paymentStatus, updates.fulfillmentStatus),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update order on PrestaShop: ${response.statusText}`);
      }

      return await this.getOrder(orderId);
    } catch (error) {
      console.error(`Error updating order ${orderId} on PrestaShop`, error);
      return null;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: createBasicAuthHeader(this.config.apiKey as string, ''),
      Accept: 'application/json',
    };
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    url = url.replace(/\/$/, '');
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  }

  private mapStatusToPrestaShop(paymentStatus?: string, fulfillmentStatus?: string): number {
    // PrestaShop order states (default IDs may vary by installation)
    // 1: Awaiting payment, 2: Payment accepted, 3: Processing, 4: Shipped, 5: Delivered
    if (fulfillmentStatus === 'fulfilled') return 5;
    if (fulfillmentStatus === 'partially_fulfilled') return 4;
    if (paymentStatus === 'paid') return 2;
    if (paymentStatus === 'refunded') return 7; // Refunded
    return 1; // Awaiting payment
  }

  private mapToPrestaShopOrder(order: Order): any {
    return {
      id_cart: 0,
      id_currency: 1,
      id_lang: 1,
      id_customer: 0,
      id_carrier: 1,
      current_state: this.mapStatusToPrestaShop(order.paymentStatus, order.fulfillmentStatus),
      payment: 'POS Payment',
      total_paid: order.total,
      total_paid_real: order.paymentStatus === 'paid' ? order.total : 0,
      total_products: order.subtotal,
      total_products_wt: order.subtotal + (order.tax || 0),
    };
  }

  protected mapToOrder(psOrder: any): Order {
    const lineItems = (psOrder.associations?.order_rows || []).map((item: any) => ({
      id: String(item.id),
      productId: String(item.product_id),
      variantId: item.product_attribute_id ? String(item.product_attribute_id) : undefined,
      sku: item.product_reference,
      name: item.product_name,
      quantity: parseInt(item.product_quantity || '1', 10),
      price: parseFloat(item.unit_price_tax_excl || '0'),
      taxable: true,
      total: parseFloat(item.total_price_tax_incl || '0'),
      properties: {},
    }));

    // Map PrestaShop order states
    let paymentStatus: Order['paymentStatus'] = 'pending';
    let fulfillmentStatus: Order['fulfillmentStatus'] = 'unfulfilled';

    const state = parseInt(psOrder.current_state || '1', 10);
    if (state >= 2 && state <= 6) paymentStatus = 'paid';
    if (state === 7) paymentStatus = 'refunded';
    if (state === 4 || state === 5) fulfillmentStatus = 'fulfilled';
    if (state === 6) fulfillmentStatus = 'partially_fulfilled';

    return {
      id: String(psOrder.id),
      platformOrderId: psOrder.reference,
      customerEmail: psOrder.associations?.customer?.email,
      customerName: `${psOrder.associations?.customer?.firstname || ''} ${psOrder.associations?.customer?.lastname || ''}`.trim(),
      lineItems,
      subtotal: parseFloat(psOrder.total_products || '0'),
      tax: parseFloat(psOrder.total_paid_tax_incl || '0') - parseFloat(psOrder.total_paid_tax_excl || '0'),
      total: parseFloat(psOrder.total_paid || '0'),
      shippingAddress: this.mapAddress(psOrder.associations?.address_delivery),
      billingAddress: this.mapAddress(psOrder.associations?.address_invoice),
      paymentStatus,
      fulfillmentStatus,
      createdAt: psOrder.date_add ? new Date(psOrder.date_add) : undefined,
      updatedAt: psOrder.date_upd ? new Date(psOrder.date_upd) : undefined,
    };
  }

  private mapAddress(address: any) {
    if (!address) return undefined;
    return {
      firstName: address.firstname,
      lastName: address.lastname,
      company: address.company,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      province: address.state_name,
      country: address.country,
      zip: address.postcode,
      phone: address.phone || address.phone_mobile,
    };
  }
}
