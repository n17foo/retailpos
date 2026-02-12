import { Order } from '../OrderServiceInterface';
import { PlatformOrderServiceInterface, PlatformConfigRequirements, PlatformOrderConfig } from './PlatformOrderServiceInterface';
import { LoggerFactory } from '../../logger/loggerFactory';
import { keyValueRepository } from '../../../repositories/KeyValueRepository';

const ORDERS_STORAGE_KEY = 'offline_local_orders';

/**
 * Offline order service for local-first POS operation
 * Stores orders locally via SQLite - no online sync
 */
export class OfflineOrderService implements PlatformOrderServiceInterface {
  private initialized: boolean = false;
  private orders: Order[] = [];
  private logger = LoggerFactory.getInstance().createLogger('OfflineOrderService');

  constructor(config?: PlatformOrderConfig) {
    // Offline service doesn't need online configuration
  }

  /**
   * Initialize the offline order service
   * Loads orders from local storage
   */
  async initialize(): Promise<boolean> {
    try {
      const storedOrders = await keyValueRepository.getItem(ORDERS_STORAGE_KEY);
      if (storedOrders) {
        const parsed = JSON.parse(storedOrders);
        this.orders = parsed.map((order: any) => ({
          ...order,
          createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
          updatedAt: order.updatedAt ? new Date(order.updatedAt) : new Date(),
        }));
        this.logger.info(`Loaded ${this.orders.length} orders from local storage`);
      }

      this.initialized = true;
      this.logger.info('Offline order service initialized (local-only mode)');
      return true;
    } catch (error) {
      this.logger.error({ message: 'Error initializing offline order service' }, error instanceof Error ? error : new Error(String(error)));
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get configuration requirements for offline platform
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: [],
      optional: ['storeName'],
      description: 'Offline local-only mode. Orders are stored locally with no online sync.',
    };
  }

  /**
   * Create a new order (stored locally only)
   */
  async createOrder(order: Order): Promise<Order> {
    if (!this.initialized) {
      await this.initialize();
    }

    const now = new Date();
    const newOrder: Order = {
      ...order,
      id: order.id || `local-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      platformOrderId: order.platformOrderId || order.id,
      createdAt: order.createdAt || now,
      updatedAt: now,
      paymentStatus: order.paymentStatus || 'pending',
      fulfillmentStatus: order.fulfillmentStatus || 'unfulfilled',
    };

    this.orders.push(newOrder);
    await this.saveOrdersToStorage();

    this.logger.info(`Created local order: ${newOrder.id} with total $${newOrder.total.toFixed(2)}`);
    return newOrder;
  }

  /**
   * Get an order by ID from local storage
   */
  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.orders.find(order => order.id === orderId) || null;
  }

  /**
   * Update an existing order
   */
  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const index = this.orders.findIndex(order => order.id === orderId);
    if (index === -1) {
      return null;
    }

    const updatedOrder: Order = {
      ...this.orders[index],
      ...updates,
      id: orderId,
      updatedAt: new Date(),
    };

    this.orders[index] = updatedOrder;
    await this.saveOrdersToStorage();

    this.logger.info(`Updated local order: ${orderId}`);
    return updatedOrder;
  }

  /**
   * Get all local orders
   */
  async getAllOrders(): Promise<Order[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  /**
   * Get orders by payment status
   */
  async getOrdersByPaymentStatus(status: Order['paymentStatus']): Promise<Order[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.orders
      .filter(order => order.paymentStatus === status)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  /**
   * Get orders by fulfillment status
   */
  async getOrdersByFulfillmentStatus(status: Order['fulfillmentStatus']): Promise<Order[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.orders
      .filter(order => order.fulfillmentStatus === status)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  /**
   * Delete an order (for testing/admin purposes)
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const index = this.orders.findIndex(order => order.id === orderId);
    if (index === -1) {
      return false;
    }

    this.orders.splice(index, 1);
    await this.saveOrdersToStorage();

    this.logger.info(`Deleted local order: ${orderId}`);
    return true;
  }

  /**
   * Clear all local orders
   */
  async clearLocalOrders(): Promise<void> {
    this.orders = [];
    await keyValueRepository.removeItem(ORDERS_STORAGE_KEY);
    this.logger.info('Cleared all local orders');
  }

  /**
   * Get order statistics
   */
  async getOrderStats(): Promise<{
    total: number;
    pending: number;
    paid: number;
    refunded: number;
    totalRevenue: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const stats = {
      total: this.orders.length,
      pending: 0,
      paid: 0,
      refunded: 0,
      totalRevenue: 0,
    };

    this.orders.forEach(order => {
      switch (order.paymentStatus) {
        case 'pending':
          stats.pending++;
          break;
        case 'paid':
        case 'partially_refunded':
          stats.paid++;
          stats.totalRevenue += order.total;
          break;
        case 'refunded':
          stats.refunded++;
          break;
      }
    });

    return stats;
  }

  /**
   * Save orders to local storage
   */
  private async saveOrdersToStorage(): Promise<void> {
    await keyValueRepository.setItem(ORDERS_STORAGE_KEY, JSON.stringify(this.orders));
  }
}

export const offlineOrderService = new OfflineOrderService();
