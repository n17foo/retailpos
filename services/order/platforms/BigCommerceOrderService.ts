import { Order } from '../OrderServiceInterface';
import { PlatformOrderConfig, PlatformConfigRequirements } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { BIGCOMMERCE_API_VERSION } from '../../config/ServiceConfigBridge';

/**
 * BigCommerce-specific implementation of the order service
 */
export class BigCommerceOrderService extends BaseOrderService {
  /**
   * Create a new BigCommerce order service
   * @param config Configuration for BigCommerce API
   */
  constructor(config: PlatformOrderConfig = {}) {
    super(config);
  }

  /**
   * Initialize the BigCommerce order service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.storeHash = this.config.storeHash || process.env.BIGCOMMERCE_STORE_HASH || '';
      this.config.accessToken = this.config.accessToken || process.env.BIGCOMMERCE_ACCESS_TOKEN || '';
      this.config.clientId = this.config.clientId || process.env.BIGCOMMERCE_CLIENT_ID || '';

      if (!this.config.storeHash || !this.config.accessToken) {
        console.warn('Missing BigCommerce API configuration');
        return false;
      }

      // Test connection with a simple API call
      try {
        const apiUrl = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v2/store`;
        const response = await fetch(apiUrl, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to BigCommerce API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to BigCommerce API', error);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize BigCommerce order service', error);
      return false;
    }
  }

  /**
   * Get configuration requirements for BigCommerce
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeHash', 'accessToken'],
      optional: ['clientId', 'webhookUrl'],
      description: 'BigCommerce order service requires store hash and access token',
    };
  }

  /**
   * Create a new order in BigCommerce
   */
  async createOrder(order: Order): Promise<Order> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce order service not initialized');
    }

    try {
      const apiUrl = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v2/orders`;

      const bcOrder = this.mapToBigCommerceOrder(order);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bcOrder),
      });

      if (!response.ok) {
        throw new Error(`Failed to create order on BigCommerce: ${response.statusText}`);
      }

      const data = await response.json();

      // Map created BigCommerce order to our format
      return this.mapToOrder(data);
    } catch (error) {
      console.error('Error creating order on BigCommerce', error);
      throw error;
    }
  }

  /**
   * Get an order by ID from BigCommerce
   */
  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce order service not initialized');
    }

    try {
      const apiUrl = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v2/orders/${orderId}`;
      const productsUrl = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v2/orders/${orderId}/products`;

      // Get the order details
      const orderResponse = await fetch(apiUrl, {
        headers: this.getAuthHeaders(),
      });

      if (!orderResponse.ok) {
        if (orderResponse.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch order from BigCommerce: ${orderResponse.statusText}`);
      }

      const orderData = await orderResponse.json();

      // Get the order products (line items)
      const productsResponse = await fetch(productsUrl, {
        headers: this.getAuthHeaders(),
      });

      if (!productsResponse.ok) {
        throw new Error(`Failed to fetch order products from BigCommerce: ${productsResponse.statusText}`);
      }

      const productsData = await productsResponse.json();

      // Combine the order data with products
      const fullOrder = {
        ...orderData,
        products: productsData,
      };

      // Map BigCommerce order to our format
      return this.mapToOrder(fullOrder);
    } catch (error) {
      console.error(`Error fetching order ${orderId} from BigCommerce`, error);
      return null;
    }
  }

  /**
   * Update an order on BigCommerce
   */
  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce order service not initialized');
    }

    try {
      const apiUrl = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v2/orders/${orderId}`;

      // Get the existing order to ensure it exists
      const existingOrder = await this.getOrder(orderId);
      if (!existingOrder) {
        throw new Error(`Order with ID ${orderId} not found`);
      }

      // BigCommerce has limited order update capabilities
      // We can only update certain fields
      const bcOrderUpdate = {
        status_id: this.mapStatusToBigCommerce(updates.paymentStatus, updates.fulfillmentStatus),
        customer_message: updates.note,
      };

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bcOrderUpdate),
      });

      if (!response.ok) {
        throw new Error(`Failed to update order on BigCommerce: ${response.statusText}`);
      }

      // Get the updated order to return
      return await this.getOrder(orderId);
    } catch (error) {
      console.error(`Error updating order ${orderId} on BigCommerce`, error);
      return null;
    }
  }

  // Refund functionality moved to dedicated refund service

  /**
   * Create authorization headers for BigCommerce API
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      'X-Auth-Token': this.config.accessToken || '',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Map our order format to BigCommerce's format
   */
  private mapToBigCommerceOrder(order: Order): any {
    // Map customer info
    const customer = {
      email: order.customerEmail,
      first_name: order.customerName?.split(' ')[0] || '',
      last_name: order.customerName?.split(' ').slice(1).join(' ') || '',
    };

    // Map addresses
    const billing_address = order.billingAddress
      ? {
          first_name: order.billingAddress.firstName,
          last_name: order.billingAddress.lastName,
          company: order.billingAddress.company,
          street_1: order.billingAddress.address1,
          street_2: order.billingAddress.address2,
          city: order.billingAddress.city,
          state: order.billingAddress.province,
          zip: order.billingAddress.zip,
          country: order.billingAddress.country,
          country_iso2: order.billingAddress.countryCode,
          phone: order.billingAddress.phone,
        }
      : {};

    const shipping_address = order.shippingAddress
      ? {
          first_name: order.shippingAddress.firstName,
          last_name: order.shippingAddress.lastName,
          company: order.shippingAddress.company,
          street_1: order.shippingAddress.address1,
          street_2: order.shippingAddress.address2,
          city: order.shippingAddress.city,
          state: order.shippingAddress.province,
          zip: order.shippingAddress.zip,
          country: order.shippingAddress.country,
          country_iso2: order.shippingAddress.countryCode,
          phone: order.shippingAddress.phone,
        }
      : {};

    // Map line items
    const products = order.lineItems.map(item => ({
      product_id: parseInt(item.productId) || 0,
      variant_id: item.variantId ? parseInt(item.variantId) : 0,
      name: item.name,
      quantity: item.quantity,
      price_inc_tax: item.price,
      price_ex_tax: item.taxable ? item.price / 1.1 : item.price, // Approximate tax calculation
      sku: item.sku,
      is_taxable: item.taxable,
    }));

    // Map status
    const status_id = this.mapStatusToBigCommerce(order.paymentStatus, order.fulfillmentStatus);

    return {
      customer_id: 0, // For guest checkout
      status_id,
      billing_address,
      shipping_addresses: [shipping_address],
      products,
      customer_message: order.note || '',
      staff_notes: '',
      subtotal_ex_tax: order.subtotal - order.tax,
      subtotal_inc_tax: order.subtotal,
      total_tax: order.tax,
      total_ex_tax: order.total - order.tax,
      total_inc_tax: order.total,
      items_total: order.lineItems.reduce((sum, item) => sum + item.quantity, 0),
      payment_method: 'Credit Card',
    };
  }

  /**
   * Map our status to BigCommerce status ID
   */
  private mapStatusToBigCommerce(paymentStatus?: Order['paymentStatus'], fulfillmentStatus?: Order['fulfillmentStatus']): number {
    // BigCommerce status IDs
    // 1 = Pending
    // 2 = Shipped
    // 3 = Partially Shipped
    // 4 = Refunded
    // 5 = Cancelled
    // 11 = Awaiting Payment
    // 12 = Awaiting Pickup
    // 14 = Awaiting Shipment

    if (paymentStatus === 'refunded') {
      return 4;
    } else if (fulfillmentStatus === 'fulfilled') {
      return 2;
    } else if (fulfillmentStatus === 'partially_fulfilled') {
      return 3;
    } else if (paymentStatus === 'paid') {
      return 14; // Awaiting Shipment
    } else {
      return 1; // Pending
    }
  }

  /**
   * Map BigCommerce status ID to our status
   */
  private mapBigCommerceStatus(statusId?: number): {
    paymentStatus: Order['paymentStatus'];
    fulfillmentStatus: Order['fulfillmentStatus'];
  } {
    let paymentStatus: Order['paymentStatus'] = 'pending';
    let fulfillmentStatus: Order['fulfillmentStatus'] = 'unfulfilled';

    switch (statusId) {
      case 1: // Pending
        paymentStatus = 'pending';
        fulfillmentStatus = 'unfulfilled';
        break;
      case 2: // Shipped
        paymentStatus = 'paid';
        fulfillmentStatus = 'fulfilled';
        break;
      case 3: // Partially Shipped
        paymentStatus = 'paid';
        fulfillmentStatus = 'partially_fulfilled';
        break;
      case 4: // Refunded
        paymentStatus = 'refunded';
        break;
      case 5: // Cancelled
        paymentStatus = 'failed';
        break;
      case 11: // Awaiting Payment
        paymentStatus = 'pending';
        break;
      case 12: // Awaiting Pickup
        paymentStatus = 'paid';
        fulfillmentStatus = 'unfulfilled';
        break;
      case 14: // Awaiting Shipment
        paymentStatus = 'paid';
        fulfillmentStatus = 'unfulfilled';
        break;
    }

    return { paymentStatus, fulfillmentStatus };
  }

  /**
   * Override the base class mapping to handle BigCommerce specific fields
   */
  protected mapToOrder(bcOrder: any): Order {
    // Extract status information
    const statusInfo = this.mapBigCommerceStatus(bcOrder.status_id);

    // Map line items
    const lineItems =
      bcOrder.products?.map((item: any) => ({
        id: item.id?.toString(),
        productId: item.product_id?.toString() || '',
        variantId: item.variant_id?.toString(),
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price_inc_tax || item.price || '0'),
        taxable: item.is_taxable !== false,
        total: parseFloat(item.price_inc_tax || item.price || '0') * item.quantity,
        properties: {},
      })) || [];

    // Map shipping address
    const shippingAddress =
      bcOrder.shipping_addresses && bcOrder.shipping_addresses[0]
        ? {
            firstName: bcOrder.shipping_addresses[0].first_name,
            lastName: bcOrder.shipping_addresses[0].last_name,
            company: bcOrder.shipping_addresses[0].company,
            address1: bcOrder.shipping_addresses[0].street_1,
            address2: bcOrder.shipping_addresses[0].street_2,
            city: bcOrder.shipping_addresses[0].city,
            province: bcOrder.shipping_addresses[0].state,
            provinceCode: bcOrder.shipping_addresses[0].state_code,
            country: bcOrder.shipping_addresses[0].country,
            countryCode: bcOrder.shipping_addresses[0].country_iso2,
            zip: bcOrder.shipping_addresses[0].zip,
            phone: bcOrder.shipping_addresses[0].phone,
          }
        : undefined;

    // Map billing address
    const billingAddress = bcOrder.billing_address
      ? {
          firstName: bcOrder.billing_address.first_name,
          lastName: bcOrder.billing_address.last_name,
          company: bcOrder.billing_address.company,
          address1: bcOrder.billing_address.street_1,
          address2: bcOrder.billing_address.street_2,
          city: bcOrder.billing_address.city,
          province: bcOrder.billing_address.state,
          provinceCode: bcOrder.billing_address.state_code,
          country: bcOrder.billing_address.country,
          countryCode: bcOrder.billing_address.country_iso2,
          zip: bcOrder.billing_address.zip,
          phone: bcOrder.billing_address.phone,
        }
      : undefined;

    return {
      id: bcOrder.id?.toString(),
      platformOrderId: bcOrder.id?.toString(),
      customerEmail: bcOrder.customer?.email || bcOrder.billing_address?.email,
      customerName:
        `${bcOrder.customer?.first_name || bcOrder.billing_address?.first_name || ''} ${bcOrder.customer?.last_name || bcOrder.billing_address?.last_name || ''}`.trim(),
      lineItems,
      subtotal: parseFloat(bcOrder.subtotal_inc_tax || bcOrder.subtotal || '0'),
      tax: parseFloat(bcOrder.total_tax || '0'),
      total: parseFloat(bcOrder.total_inc_tax || bcOrder.total || '0'),
      shippingAddress,
      billingAddress,
      paymentStatus: statusInfo.paymentStatus,
      fulfillmentStatus: statusInfo.fulfillmentStatus,
      note: bcOrder.customer_message,
      createdAt: bcOrder.date_created ? new Date(bcOrder.date_created) : undefined,
      updatedAt: bcOrder.date_modified ? new Date(bcOrder.date_modified) : undefined,
    };
  }
}
