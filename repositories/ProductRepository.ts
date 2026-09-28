import { db } from '../utils/db';
import { generateUUID } from '../utils/uuid';
import { buildUpdateAssignments } from '../utils/sql';

const PRODUCT_UPDATE_COLUMNS = ['name', 'description', 'price', 'sku', 'barcode', 'category_id', 'stock'] as const;

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
  async create(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const now = Date.now();
    const id = generateUUID();
    const result = await db.runAsync(
      'INSERT INTO products (id, name, description, price, sku, barcode, category_id, stock, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        product.name,
        product.description,
        product.price,
        product.sku,
        product.barcode,
        product.category_id,
        product.stock,
        now,
        now,
      ] as (string | number | boolean)[]
    );
    return result.lastInsertRowId.toString();
  }

  async findById(id: string): Promise<Product | null> {
    return await db.getFirstAsync<Product>('SELECT * FROM products WHERE id = ?', [id]);
  }

  async findAll(): Promise<Product[]> {
    return await db.getAllAsync<Product>('SELECT * FROM products');
  }

  async update(id: string, data: Partial<Product>): Promise<void> {
    const { assignments, values } = buildUpdateAssignments(data, PRODUCT_UPDATE_COLUMNS);
    if (assignments.length === 0) return;
    await db.runAsync(`UPDATE products SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`, [...values, Date.now(), id]);
  }

  async delete(id: string): Promise<void> {
    await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(', ');
    return await db.getAllAsync<Product>(`SELECT * FROM products WHERE id IN (${placeholders})`, ids);
  }
}
