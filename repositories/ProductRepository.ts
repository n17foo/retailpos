import { sqliteStorage } from '../services/storage/SQLiteStorageService';
import { type SQLiteDatabase } from 'expo-sqlite';

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  sku?: string | null;
  barcode?: string | null;
  category_id?: string | null;
  stock: number;
  created_at: number;
  updated_at: number;
}

export class ProductRepository {
  private db: SQLiteDatabase;

  constructor() {
    this.db = sqliteStorage.getDatabase();
  }

  async create(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const now = Date.now();
    const id = crypto.randomUUID();
    const result = await this.db.runAsync(
      'INSERT INTO products (id, name, description, price, sku, barcode, category_id, stock, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, product.name, product.description, product.price, product.sku, product.barcode, product.category_id, product.stock, now, now]
    );
    return result.lastInsertRowId.toString();
  }

  async findById(id: string): Promise<Product | null> {
    return await this.db.getFirstAsync<Product>('SELECT * FROM products WHERE id = ?', [id]);
  }

  async findAll(): Promise<Product[]> {
    return await this.db.getAllAsync<Product>('SELECT * FROM products');
  }

  async update(id: string, data: Partial<Product>): Promise<void> {
    const now = Date.now();
    const fields = Object.keys(data).filter(key => key !== 'id');
    const values = fields.map(key => data[key as keyof typeof data]);
    const statement = `UPDATE products SET ${fields.map(field => `${field} = ?`).join(', ')}, updated_at = ? WHERE id = ?`;

    await this.db.runAsync(statement, [...values, now, id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM products WHERE id = ?', [id]);
  }
}
