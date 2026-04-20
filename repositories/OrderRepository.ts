import { CreateOrderItemInput } from './OrderItemRepository';
import { instoreApiConfig } from '../services/instoreapi/InstoreApiConfig';
import { OfflineOrderRepository } from './OfflineOrderRepository';
import { InstoreApiOrderRepository } from './InstoreApiOrderRepository';

/** DB row shape for the unified orders table */
export interface OrderRow {
  id: string;
  platform_order_id: string | null;
  platform: string | null;
  subtotal: number;
  tax: number;
  total: number;
  discount_amount: number | null;
  discount_code: string | null;
  customer_email: string | null;
  customer_name: string | null;
  note: string | null;
  payment_method: string | null;
  payment_transaction_id: string | null;
  cashier_id: string | null;
  cashier_name: string | null;
  status: string;
  sync_status: string;
  sync_error: string | null;
  created_at: number;
  updated_at: number;
  paid_at: number | null;
  synced_at: number | null;
}

export interface CreateOrderInput {
  id: string;
  platform: string | null;
  subtotal: number;
  tax: number;
  total: number;
  discountAmount: number | null;
  discountCode: string | null;
  customerEmail: string | null;
  customerName: string | null;
  note: string | null;
  cashierId: string | null;
  cashierName: string | null;
  platformOrderId?: string | null;
  status?: string;
}

/**
 * Contract for order persistence.
 * Implemented by OfflineOrderRepository (SQLite) and LocalApiOrderRepository (HTTP).
 * Use getOrderRepository() to get the right implementation for the current mode.
 */
export interface OrderRepository {
  create(input: CreateOrderInput): Promise<void>;
  createWithItems(input: CreateOrderInput, items: CreateOrderItemInput[]): Promise<void>;
  findById(orderId: string): Promise<OrderRow | null>;
  findAll(status?: string): Promise<OrderRow[]>;
  findUnsynced(): Promise<OrderRow[]>;
  findByDateRange(fromTimestamp: number, toTimestamp: number, cashierId?: string): Promise<OrderRow[]>;
  updateStatus(orderId: string, status: string): Promise<void>;
  updatePayment(orderId: string, paymentMethod: string, transactionId: string | null): Promise<void>;
  updateSyncSuccess(orderId: string, platformOrderId: string): Promise<void>;
  updateSyncError(orderId: string, syncStatus: string, errorMessage: string): Promise<void>;
  delete(orderId: string): Promise<void>;
}

/** Singleton offline instance for direct use in standalone/server mode */
export const orderRepository = new OfflineOrderRepository();

/**
 * Factory — returns the right OrderRepository implementation for the current mode.
 * Standalone / server → OfflineOrderRepository (SQLite)
 * Client             → LocalApiOrderRepository (HTTP to server register)
 */
export function getOrderRepository(): OrderRepository {
  if (instoreApiConfig.isClient) {
    return new InstoreApiOrderRepository();
  }
  return orderRepository;
}
