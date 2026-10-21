import { db } from '../../../shared/utils/db';
import { CreateOrderItemInput, OrderItemRepository } from './OrderItemRepository';
import { CreateOrderInput, OrderRepository, OrderRow } from './OrderRepository';

/**
 * SQLite implementation — used in standalone and server modes.
 */
export class OfflineOrderRepository implements OrderRepository {
  // ── Create ────────────────────────────────────────────────────────────

  async create(input: CreateOrderInput): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO orders (
        id, platform, platform_order_id, subtotal, tax, total,
        discount_amount, discount_code, customer_email, customer_name, note, sale_mode,
        cashier_id, cashier_name, register_id,
        status, sync_status, payments_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.platform,
        input.platformOrderId ?? null,
        input.subtotal,
        input.tax,
        input.total,
        input.discountAmount,
        input.discountCode,
        input.customerEmail,
        input.customerName,
        input.note,
        input.saleMode ?? null,
        input.cashierId,
        input.cashierName,
        input.registerId ?? null,
        input.status ?? 'pending',
        'pending',
        input.paymentsJson ?? null,
        now,
        now,
      ]
    );
  }

  async createWithItems(input: CreateOrderInput, items: CreateOrderItemInput[]): Promise<void> {
    await this.create(input);
    await new OrderItemRepository().createMany(items);
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

  async updatePaymentLines(orderId: string, paymentMethod: string, transactionId: string | null, paymentsJson: string): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `UPDATE orders SET status = ?, payment_method = ?, payment_transaction_id = ?, payments_json = ?, paid_at = ?, updated_at = ? WHERE id = ?`,
      ['paid', paymentMethod, transactionId, paymentsJson, now, now, orderId]
    );
  }

  async claimSync(_orderId: string): Promise<boolean> {
    // Single process owns the local DB — nothing else can race the push.
    return true;
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
