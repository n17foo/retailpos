import { OrderItemRepository, OrderItemRow, CreateOrderItemInput } from './OrderItemRepository';
import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';

/**
 * Order-items source for client registers — items live on the Store API
 * server; a client's local order_items table stays empty.
 */
export class InstoreApiOrderItemRepository implements OrderItemRepository {
  async createMany(items: CreateOrderItemInput[]): Promise<void> {
    // Items are created server-side inside the createOrder payload — nothing
    // to persist locally in client mode.
    void items;
  }

  async findByOrderId(orderId: string): Promise<OrderItemRow[]> {
    return instoreApiClient.getOrderItems([orderId]);
  }

  async deleteByOrderId(orderId: string): Promise<void> {
    // The server owns order/item lifecycle — a cancelled order drops its items.
    void orderId;
  }
}
