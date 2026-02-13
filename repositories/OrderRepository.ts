import { db } from '../utils/db';
import { generateUUID } from '../utils/uuid';

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
}

export class OrderRepository {
  // ── Create ────────────────────────────────────────────────────────────

  async create(input: CreateOrderInput): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO orders (
        id, platform, subtotal, tax, total,
        discount_amount, discount_code, customer_email, customer_name, note,
        cashier_id, cashier_name,
        status, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.platform,
        input.subtotal,
        input.tax,
        input.total,
        input.discountAmount,
        input.discountCode,
        input.customerEmail,
        input.customerName,
        input.note,
        input.cashierId,
        input.cashierName,
        'pending',
        'pending',
        now,
        now,
      ]
    );
  }

  // ── Read ──────────────────────────────────────────────────────────────

  async findById(orderId: string): Promise<OrderRow | null> {
    return db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE id = ?', [orderId]);
  }

  async findAll(status?: string): Promise<OrderRow[]> {
    if (status) {
      return db.getAllAsync<OrderRow>('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC', [status]);
    }
    return db.getAllAsync<OrderRow>('SELECT * FROM orders ORDER BY created_at DESC');
  }

  async findUnsynced(): Promise<OrderRow[]> {
    return db.getAllAsync<OrderRow>(`SELECT * FROM orders WHERE status = ? AND sync_status != ? ORDER BY created_at ASC`, [
      'paid',
      'synced',
    ]);
  }

  async findByDateRange(fromTimestamp: number, toTimestamp: number, cashierId?: string): Promise<OrderRow[]> {
    if (cashierId) {
      return db.getAllAsync<OrderRow>(
        'SELECT * FROM orders WHERE created_at >= ? AND created_at < ? AND cashier_id = ? ORDER BY created_at DESC',
        [fromTimestamp, toTimestamp, cashierId]
      );
    }
    return db.getAllAsync<OrderRow>('SELECT * FROM orders WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC', [
      fromTimestamp,
      toTimestamp,
    ]);
  }

  async findDistinctCashiers(): Promise<{ cashier_id: string; cashier_name: string }[]> {
    return db.getAllAsync<{ cashier_id: string; cashier_name: string }>(
      'SELECT DISTINCT cashier_id, cashier_name FROM orders WHERE cashier_id IS NOT NULL ORDER BY cashier_name ASC'
    );
  }

  // ── Update ────────────────────────────────────────────────────────────

  async updateStatus(orderId: string, status: string): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [status, now, orderId]);
  }

  async updatePayment(orderId: string, paymentMethod: string, transactionId: string | null): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `UPDATE orders SET status = ?, payment_method = ?, payment_transaction_id = ?, paid_at = ?, updated_at = ? WHERE id = ?`,
      ['paid', paymentMethod, transactionId, now, now, orderId]
    );
  }

  async updateSyncSuccess(orderId: string, platformOrderId: string): Promise<void> {
    const now = Date.now();
    await db.runAsync(`UPDATE orders SET platform_order_id = ?, sync_status = ?, synced_at = ?, updated_at = ? WHERE id = ?`, [
      platformOrderId,
      'synced',
      now,
      now,
      orderId,
    ]);
  }

  async updateSyncError(orderId: string, syncStatus: string, errorMessage: string): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE orders SET sync_status = ?, sync_error = ?, updated_at = ? WHERE id = ?', [
      syncStatus,
      errorMessage,
      now,
      orderId,
    ]);
  }

  // ── Delete ────────────────────────────────────────────────────────────

  async delete(orderId: string): Promise<void> {
    await db.runAsync('DELETE FROM orders WHERE id = ?', [orderId]);
  }
}

export const orderRepository = new OrderRepository();
