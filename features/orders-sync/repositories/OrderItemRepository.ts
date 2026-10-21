import { db } from '../../../shared/utils/db';
import { generateUUID } from '../../../shared/utils/uuid';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';
import { InstoreApiOrderItemRepository } from './InstoreApiOrderItemRepository';

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
  option_summary: string | null;
  tax_code: string | null;
  tax_profile_id: string | null;
  inventory_policy: string | null;
  catalog_version: string | null;
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
  optionSummary?: string | null;
  taxCode?: string | null;
  taxProfileId?: string | null;
  inventoryPolicy?: 'deny' | 'continue' | null;
  catalogVersion?: string | null;
}

export class OrderItemRepository {
  async createMany(items: CreateOrderItemInput[]): Promise<void> {
    for (const item of items) {
      const id = generateUUID();
      await db.runAsync(
        `INSERT INTO order_items (
          id, order_id, product_id, variant_id, sku, name, price, quantity,
          image, taxable, tax_rate, is_ecommerce_product, original_id, properties,
          option_summary, tax_code, tax_profile_id, inventory_policy, catalog_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          item.optionSummary ?? null,
          item.taxCode ?? null,
          item.taxProfileId ?? null,
          item.inventoryPolicy ?? null,
          item.catalogVersion ?? null,
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

/**
 * Factory — returns the right order-items source for the current mode.
 * Standalone → local SQLite. Client register → Store API (items live on the
 * server; a client's local order_items table stays empty).
 */
export function getOrderItemRepository(): OrderItemRepository {
  if (instoreApiConfig.isClient) {
    return new InstoreApiOrderItemRepository();
  }
  return orderItemRepository;
}
