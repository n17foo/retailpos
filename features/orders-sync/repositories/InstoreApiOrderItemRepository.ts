import { OrderItemRepository, OrderItemRow, CreateOrderItemInput, orderItemRepository } from './OrderItemRepository';
import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { pendingOrderStore } from '../../multi-register/services/offline/PendingOrderStore';
import { isStoreApiUnavailable } from '../../multi-register/services/offline/isStoreApiUnavailable';

/**
 * Order-items source for client registers — items live on the Store API
 * server; a client's local order_items table only holds line items for
 * orders queued during a LAN outage.
 */
export class InstoreApiOrderItemRepository implements OrderItemRepository {
  async createMany(items: CreateOrderItemInput[]): Promise<void> {
    // Items are created server-side inside the createOrder payload — nothing
    // to persist locally in client mode.
    void items;
  }

  async findByOrderId(orderId: string): Promise<OrderItemRow[]> {
    // Locally-queued orders aren't on the server — serve their items from
    // local SQLite even when the LAN is up.
    if (await pendingOrderStore.isPending(orderId)) {
      return orderItemRepository.findByOrderId(orderId);
    }
    try {
      return await instoreApiClient.getOrderItems([orderId]);
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      return orderItemRepository.findByOrderId(orderId);
    }
  }

  async deleteByOrderId(orderId: string): Promise<void> {
    // The server owns order/item lifecycle — a cancelled order drops its items.
    void orderId;
  }
}
