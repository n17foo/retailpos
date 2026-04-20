import { OrderRepository, OrderRow, CreateOrderInput } from './OrderRepository';
import { CreateOrderItemInput } from './OrderItemRepository';
import { instoreApiClient } from '../services/clients/instoreapi/InstoreApiClient';

export class InstoreApiOrderRepository implements OrderRepository {
  async create(input: CreateOrderInput): Promise<void> {
    // In client mode, create is always called via createWithItems
    // This no-op prevents double-creation if called directly
    await instoreApiClient.createOrder(input, []);
  }

  async createWithItems(input: CreateOrderInput, items: CreateOrderItemInput[]): Promise<void> {
    await instoreApiClient.createOrder(input, items);
  }

  async findById(orderId: string): Promise<OrderRow | null> {
    const result = await instoreApiClient.getOrder(orderId);
    return result?.order ?? null;
  }

  async findAll(status?: string): Promise<OrderRow[]> {
    return instoreApiClient.getOrders(status);
  }

  async findUnsynced(): Promise<OrderRow[]> {
    return instoreApiClient.getUnsyncedOrders();
  }

  async findByDateRange(fromTimestamp: number, toTimestamp: number, cashierId?: string): Promise<OrderRow[]> {
    // Server doesn't have a date-range endpoint yet — fall back to getOrders and filter client-side
    const rows = await instoreApiClient.getOrders();
    return rows.filter(r => {
      const inRange = r.created_at >= fromTimestamp && r.created_at < toTimestamp;
      return cashierId ? inRange && r.cashier_id === cashierId : inRange;
    });
  }

  async updateStatus(orderId: string, status: string): Promise<void> {
    await instoreApiClient.updateOrderStatus(orderId, status);
  }

  async updatePayment(orderId: string, paymentMethod: string, transactionId: string | null): Promise<void> {
    await instoreApiClient.updateOrderPayment(orderId, paymentMethod, transactionId ?? undefined);
  }

  async updateSyncSuccess(orderId: string, platformOrderId: string): Promise<void> {
    // Sync success is managed by the server — no-op on client
    void orderId;
    void platformOrderId;
  }

  async updateSyncError(orderId: string, syncStatus: string, errorMessage: string): Promise<void> {
    // Sync errors are managed by the server — no-op on client
    void orderId;
    void syncStatus;
    void errorMessage;
  }

  async delete(orderId: string): Promise<void> {
    await instoreApiClient.updateOrderStatus(orderId, 'cancelled');
  }
}
