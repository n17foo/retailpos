import { OrderRepository, OrderRow, CreateOrderInput } from './OrderRepository';
import { CreateOrderItemInput } from './OrderItemRepository';
import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { pendingOrderStore } from '../../multi-register/services/offline/PendingOrderStore';
import { isStoreApiUnavailable } from '../../multi-register/services/offline/isStoreApiUnavailable';

/**
 * Store-API-backed order repository for client registers.
 *
 * LAN outage behavior: writes that can't reach the server are queued locally
 * (see PendingOrderStore) and uploaded on recovery, preserving ids, register
 * and timestamps; reads merge locally-queued orders so a sale stays visible
 * in history before it reaches the server.
 */
export class InstoreApiOrderRepository implements OrderRepository {
  async create(input: CreateOrderInput): Promise<void> {
    // In client mode, create is always called via createWithItems
    // This no-op prevents double-creation if called directly
    await this.createWithItems(input, []);
  }

  async createWithItems(input: CreateOrderInput, items: CreateOrderItemInput[]): Promise<void> {
    try {
      await instoreApiClient.createOrder(input, items);
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      await pendingOrderStore.queueOrder(input, items);
    }
  }

  async findById(orderId: string): Promise<OrderRow | null> {
    const pending = await pendingOrderStore.findPendingById(orderId);
    try {
      const result = await instoreApiClient.getOrder(orderId);
      return result?.order ?? pending;
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      return pending;
    }
  }

  async findAll(status?: string): Promise<OrderRow[]> {
    const pending = await pendingOrderStore.listPending(status);
    try {
      const remote = await instoreApiClient.getOrders(status);
      return [...remote, ...pending];
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      return pending;
    }
  }

  async findUnsynced(): Promise<OrderRow[]> {
    // Pending-upload orders aren't on the server yet — they can't be claimed
    // or pushed to a platform, so they're excluded until the flush uploads
    // them (the server's normal pending→claim path takes over from there).
    try {
      return await instoreApiClient.getUnsyncedOrders();
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      return [];
    }
  }

  async findByDateRange(fromTimestamp: number, toTimestamp: number, cashierId?: string): Promise<OrderRow[]> {
    const pending = (await pendingOrderStore.listPending()).filter(
      o => o.created_at >= fromTimestamp && o.created_at < toTimestamp && (!cashierId || o.cashier_id === cashierId)
    );
    try {
      const remote = await instoreApiClient.getOrdersInRange(fromTimestamp, toTimestamp, cashierId ? { cashierId } : undefined);
      return [...remote, ...pending];
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      return pending;
    }
  }

  async updateStatus(orderId: string, status: string): Promise<void> {
    try {
      await instoreApiClient.updateOrderStatus(orderId, status);
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      await pendingOrderStore.applyOrQueueStatus(orderId, status);
    }
  }

  async updatePayment(orderId: string, paymentMethod: string, transactionId: string | null): Promise<void> {
    try {
      await instoreApiClient.updateOrderPayment(orderId, paymentMethod, transactionId ?? undefined);
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      await pendingOrderStore.applyOrQueuePayment(orderId, paymentMethod, transactionId);
    }
  }

  async updatePaymentLines(orderId: string, paymentMethod: string, transactionId: string | null, paymentsJson: string): Promise<void> {
    try {
      await instoreApiClient.updateOrderPayment(orderId, paymentMethod, transactionId ?? undefined, paymentsJson);
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      await pendingOrderStore.applyOrQueuePayment(orderId, paymentMethod, transactionId, paymentsJson);
    }
  }

  async claimSync(orderId: string): Promise<boolean> {
    try {
      return await instoreApiClient.claimOrderSync(orderId);
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      return false; // can't claim while the server is unreachable
    }
  }

  async updateSyncSuccess(orderId: string, platformOrderId: string): Promise<void> {
    // The client pushed the order to the platform itself — record the outcome
    // on the server so its row stays authoritative.
    try {
      await instoreApiClient.updateOrderSync(orderId, 'synced', platformOrderId);
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      await pendingOrderStore.applyOrQueueSyncResult(orderId, 'synced', platformOrderId);
    }
  }

  async updateSyncError(orderId: string, syncStatus: string, errorMessage: string): Promise<void> {
    try {
      await instoreApiClient.updateOrderSync(orderId, syncStatus, undefined, errorMessage);
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      await pendingOrderStore.applyOrQueueSyncResult(orderId, syncStatus, undefined, errorMessage);
    }
  }

  async delete(orderId: string): Promise<void> {
    try {
      await instoreApiClient.updateOrderStatus(orderId, 'cancelled');
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      await pendingOrderStore.applyOrQueueStatus(orderId, 'cancelled');
    }
  }
}
