import { sqliteStorage } from '../services/storage/SQLiteStorageService';
import { type SQLiteDatabase } from 'expo-sqlite';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number; // Price at the time of sale
}

export class OrderItemRepository {
  private db: SQLiteDatabase;

  constructor() {
    this.db = sqliteStorage.getDatabase();
  }

  async create(item: Omit<OrderItem, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    const result = await this.db.runAsync('INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)', [
      id,
      item.order_id,
      item.product_id,
      item.quantity,
      item.price,
    ]);
    return result.lastInsertRowId.toString();
  }

  async findByOrderId(orderId: string): Promise<OrderItem[]> {
    return await this.db.getAllAsync<OrderItem>('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  }

  async update(id: string, data: Partial<OrderItem>): Promise<void> {
    const fields = Object.keys(data).filter(key => key !== 'id');
    const values = fields.map(key => data[key as keyof typeof data]);
    const statement = `UPDATE order_items SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`;

    await this.db.runAsync(statement, [...values, id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM order_items WHERE id = ?', [id]);
  }

  async deleteByOrderId(orderId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  }
}
