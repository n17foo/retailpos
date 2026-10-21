import { OrderRepository, OrderRow, CreateOrderInput } from './OrderRepository';
import { CreateOrderItemInput } from './OrderItemRepository';
import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';

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
    return instoreApiClient.getOrdersInRange(fromTimestamp, toTimestamp, cashierId ? { cashierId } : undefined);
  }

  async updateStatus(orderId: string, status: string): Promise<void> {
    await instoreApiClient.updateOrderStatus(orderId, status);
  }

  async updatePayment(orderId: string, paymentMethod: string, transactionId: string | null): Promise<void> {
    await instoreApiClient.updateOrderPayment(orderId, paymentMethod, transactionId ?? undefined);
  }

  async updatePaymentLines(orderId: string, paymentMethod: string, transactionId: string | null, paymentsJson: string): Promise<void> {
    await instoreApiClient.updateOrderPayment(orderId, paymentMethod, transactionId ?? undefined, paymentsJson);
  }

  async claimSync(orderId: string): Promise<boolean> {
    return instoreApiClient.claimOrderSync(orderId);
  }

  async updateSyncSuccess(orderId: string, platformOrderId: string): Promise<void> {
    // The client pushed the order to the platform itself — record the outcome
    // on the server so its row stays authoritative.
    await instoreApiClient.updateOrderSync(orderId, 'synced', platformOrderId);
  }

  async updateSyncError(orderId: string, syncStatus: string, errorMessage: string): Promise<void> {
    await instoreApiClient.updateOrderSync(orderId, syncStatus, undefined, errorMessage);
  }

  async delete(orderId: string): Promise<void> {
    await instoreApiClient.updateOrderStatus(orderId, 'cancelled');
  }
}
