import { db } from '../../../shared/utils/db';
import { generateUUID } from '../../../shared/utils/uuid';
import { CreateReturnInput, ReturnRepository, ReturnRow } from './ReturnRepository';

/**
 * SQLite implementation — used in standalone and server modes.
 */
export class OfflineReturnRepository implements ReturnRepository {
  async create(input: CreateReturnInput): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO returns (
        id, order_id, order_item_id, product_id, variant_id, product_name,
        quantity, refund_amount, reason, restock, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id,
        input.orderId,
        input.orderItemId ?? null,
        input.productId,
        input.variantId ?? null,
        input.productName,
        input.quantity,
        input.refundAmount,
        input.reason ?? null,
        input.restock !== false ? 1 : 0,
        now,
        now,
      ]
    );
    return id;
  }

  async findById(id: string): Promise<ReturnRow | null> {
    return db.getFirstAsync<ReturnRow>('SELECT * FROM returns WHERE id = ?', [id]);
  }

  async findByOrderId(orderId: string): Promise<ReturnRow[]> {
    return db.getAllAsync<ReturnRow>('SELECT * FROM returns WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
  }

  async findAll(status?: string): Promise<ReturnRow[]> {
    if (status) {
      return db.getAllAsync<ReturnRow>('SELECT * FROM returns WHERE status = ? ORDER BY created_at DESC', [status]);
    }
    return db.getAllAsync<ReturnRow>('SELECT * FROM returns ORDER BY created_at DESC');
  }

  async findByDateRange(from: number, to: number): Promise<ReturnRow[]> {
    return db.getAllAsync<ReturnRow>('SELECT * FROM returns WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC', [from, to]);
  }

  async updateStatus(id: string, status: string, processedBy?: string): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE returns SET status = ?, processed_by = ?, processed_at = ?, updated_at = ? WHERE id = ?', [
      status,
      processedBy ?? null,
      now,
      now,
      id,
    ]);
  }

  async delete(id: string): Promise<void> {
    await db.runAsync('DELETE FROM returns WHERE id = ?', [id]);
  }

  async linkToExchange(returnId: string, exchangeOrderId: string): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE returns SET exchange_order_id = ?, updated_at = ? WHERE id = ?', [exchangeOrderId, now, returnId]);
  }
}
