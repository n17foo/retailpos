/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order } from '../OrderServiceInterface';
import { PlatformConfigRequirements, PlatformOrderConfig } from './PlatformOrderServiceInterface';
import { BaseOrderService } from './BaseOrderService';
import { keyValueRepository } from '../../../../../shared/repositories/KeyValueRepository';

const ORDERS_STORAGE_KEY = 'offline_local_orders';

/**
 * Offline order service for local-first POS operation.
 * Stores orders in KeyValue storage — no online sync.
 *
 * Draft lifecycle: createDraftOrder / cancelDraftOrder / completeOrder are
 * all no-ops for offline mode because the authoritative store is SQLite
 * (managed by CheckoutService). These methods return immediately so the
 * checkout flow works identically regardless of platform.
 */
export class OfflineOrderService extends BaseOrderService {
  private orders: Order[] = [];

  constructor(config?: PlatformOrderConfig) {
    super(config);
  }

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
      }
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error({ message: 'Error initializing offline order service' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: [],
      optional: ['storeName'],
      description: 'Offline local-only mode. Orders are stored locally with no online sync.',
    };
  }

  // ── Draft lifecycle — no-ops for offline ─────────────────────────────
  // Offline orders are fully managed by CheckoutService + SQLite.
  // These return immediately so the checkout flow is not blocked.

  async createDraftOrder(order: Order): Promise<Order> {
    // No platform draft needed — return the order unchanged so CheckoutService
    // uses basket totals directly (status stays 'pending', no platformOrderId).
    return { ...order, paymentStatus: 'draft' };
  }

  async cancelDraftOrder(_platformOrderId: string): Promise<void> {
    // Nothing to cancel on the platform — local SQLite row is deleted by CheckoutService.
  }

  async completeOrder(_platformOrderId: string, _paymentMethod: string): Promise<Order | null> {
    // Nothing to complete on the platform — local SQLite already records payment.
    return null;
  }

  // ── Standard order CRUD (KeyValue store) ─────────────────────────────

  async createOrder(order: Order): Promise<Order> {
    if (!this.initialized) await this.initialize();

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
    return newOrder;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.initialized) await this.initialize();
    return this.orders.find(o => o.id === orderId) || null;
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    if (!this.initialized) await this.initialize();

    const index = this.orders.findIndex(o => o.id === orderId);
    if (index === -1) return null;

    const updatedOrder: Order = { ...this.orders[index], ...updates, id: orderId, updatedAt: new Date() };
    this.orders[index] = updatedOrder;
    await this.saveOrdersToStorage();
    return updatedOrder;
  }

  private async saveOrdersToStorage(): Promise<void> {
    await keyValueRepository.setItem(ORDERS_STORAGE_KEY, JSON.stringify(this.orders));
  }
}

export const offlineOrderService = new OfflineOrderService();
