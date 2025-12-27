import { sqliteStorage } from '../services/storage/SQLiteStorageService';
import { type SQLiteDatabase } from 'expo-sqlite';

export interface Order {
  id: string;
  customer_id?: string | null;
  date: number;
  total: number;
  payment_method?: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export class OrderRepository {
  private db: SQLiteDatabase;

  constructor() {
    this.db = sqliteStorage.getDatabase();
  }

  async create(order: Omit<Order, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const now = Date.now();
    const id = crypto.randomUUID();
    const result = await this.db.runAsync(
      'INSERT INTO orders (id, customer_id, date, total, payment_method, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, order.customer_id, order.date, order.total, order.payment_method, order.status, now, now]
    );
    return result.lastInsertRowId.toString();
  }

  async findById(id: string): Promise<Order | null> {
    return await this.db.getFirstAsync<Order>('SELECT * FROM orders WHERE id = ?', [id]);
  }

  async findAll(): Promise<Order[]> {
    return await this.db.getAllAsync<Order>('SELECT * FROM orders ORDER BY date DESC');
  }

  async update(id: string, data: Partial<Order>): Promise<void> {
    const now = Date.now();
    const fields = Object.keys(data).filter(key => key !== 'id');
    const values = fields.map(key => data[key as keyof typeof data]);
    const statement = `UPDATE orders SET ${fields.map(field => `${field} = ?`).join(', ')}, updated_at = ? WHERE id = ?`;

    await this.db.runAsync(statement, [...values, now, id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM orders WHERE id = ?', [id]);
  }
}
