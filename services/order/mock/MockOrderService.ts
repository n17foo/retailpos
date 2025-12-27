import { Order, OrderServiceInterface, OrderLineItem } from '../OrderServiceInterface';
import { Product, ProductResult, ProductQueryOptions } from '../../product/ProductServiceInterface';
import { MockProductService } from '../../product/mock/MockProductService';
import { RefundResult } from '../../refund/refundServiceInterface';

export class MockOrderService implements OrderServiceInterface {
  private orders: Map<string, Order> = new Map();
  private products: Product[] = [];
  private nextOrderId = 1000;

  constructor() {
    this.initializeMockData();
  }

  private async initializeMockData(): Promise<void> {
    const productService = new MockProductService();
    const productResult: ProductResult = await productService.getProducts({ limit: 100 });
    this.products = productResult.products;

    for (let i = 0; i < 5; i++) {
      const orderId = `order-${i}`;
      const lineItemsCount = Math.floor(Math.random() * 3) + 1;
      const lineItems: OrderLineItem[] = [];

      for (let j = 0; j < lineItemsCount; j++) {
        const product = this.products[Math.floor(Math.random() * this.products.length)];
        if (product && product.variants.length > 0) {
          const variant = product.variants[0];
          const quantity = Math.floor(Math.random() * 2) + 1;
          lineItems.push({
            id: `line-${i}-${j}`,
            productId: product.id,
            variantId: variant.id,
            name: product.title,
            quantity,
            price: variant.price,
            sku: variant.sku,
            taxable: true,
            total: quantity * variant.price,
          });
        }
      }

      if (lineItems.length === 0) continue;

      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const tax = parseFloat((subtotal * 0.1).toFixed(2));

      const order: Order = {
        id: orderId,
        platformOrderId: `inm-${orderId}`,
        customerEmail: `customer${i}@example.com`,
        customerName: `Customer ${i}`,
        lineItems,
        subtotal,
        tax,
        total: subtotal + tax,
        paymentStatus: i === 0 ? 'pending' : 'paid',
        fulfillmentStatus: i === 4 ? 'fulfilled' : i === 3 ? 'partially_fulfilled' : 'unfulfilled',
        createdAt: new Date(Date.now() - i * 86400000),
        updatedAt: new Date(Date.now() - i * 43200000),
      };
      this.orders.set(orderId, order);
    }
  }

  async createOrder(order: Order): Promise<Order> {
    const newOrderId = `order-${this.nextOrderId++}`;
    const newOrder: Order = {
      ...order,
      id: newOrderId,
      platformOrderId: `inm-${newOrderId}`,
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.set(newOrderId, newOrder);
    return Promise.resolve(newOrder);
  }

  async getOrder(id: string): Promise<Order | null> {
    return Promise.resolve(this.orders.get(id) || null);
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    const order = this.orders.get(orderId);
    if (order) {
      const updatedOrder = { ...order, ...updates, updatedAt: new Date() };
      this.orders.set(orderId, updatedOrder);
      return Promise.resolve(updatedOrder);
    }
    return Promise.resolve(null);
  }

  async processRefund(orderId: string): Promise<RefundResult> {
    const order = this.orders.get(orderId);
    if (!order) {
      return Promise.resolve({ success: false, error: 'Order not found', timestamp: new Date() });
    }
    // Mock logic for refund
    order.paymentStatus = 'refunded';
    order.updatedAt = new Date();
    this.orders.set(orderId, order);
    return Promise.resolve({ success: true, refundId: `refund-${Date.now()}`, timestamp: new Date() });
  }
}
