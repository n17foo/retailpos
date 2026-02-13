import { db } from '../utils/db';
import { generateUUID } from '../utils/uuid';

/** DB row shape for the order_items table */
export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  sku: string | null;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  taxable: number; // SQLite stores booleans as 0/1
  tax_rate: number | null;
  is_ecommerce_product: number;
  original_id: string | null;
  properties: string | null; // JSON string
}

export interface CreateOrderItemInput {
  orderId: string;
  productId: string;
  variantId?: string | null;
  sku?: string | null;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  taxable: boolean;
  taxRate?: number | null;
  isEcommerceProduct?: boolean;
  originalId?: string | null;
  properties?: Record<string, string> | null;
}

export class OrderItemRepository {
  async createMany(items: CreateOrderItemInput[]): Promise<void> {
    for (const item of items) {
      const id = generateUUID();
      await db.runAsync(
        `INSERT INTO order_items (
          id, order_id, product_id, variant_id, sku, name, price, quantity,
          image, taxable, tax_rate, is_ecommerce_product, original_id, properties
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.orderId,
          item.productId,
          item.variantId ?? null,
          item.sku ?? null,
          item.name,
          item.price,
          item.quantity,
          item.image ?? null,
          item.taxable ? 1 : 0,
          item.taxRate ?? null,
          item.isEcommerceProduct ? 1 : 0,
          item.originalId ?? null,
          item.properties ? JSON.stringify(item.properties) : null,
        ]
      );
    }
  }

  async findByOrderId(orderId: string): Promise<OrderItemRow[]> {
    return db.getAllAsync<OrderItemRow>('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  }

  async deleteByOrderId(orderId: string): Promise<void> {
    await db.runAsync('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  }
}

export const orderItemRepository = new OrderItemRepository();
