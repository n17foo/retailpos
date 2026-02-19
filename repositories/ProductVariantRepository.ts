import { db } from '../utils/db';
import { generateUUID } from '../utils/uuid';

export interface ProductVariantRow {
  id: string;
  product_id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  inventory_quantity: number;
  track_inventory: number;
  allow_backorder: number;
  weight: number | null;
  weight_unit: string;
  requires_shipping: number;
  taxable: number;
  tax_code: string | null;
  option_values: string; // JSON array
  image_id: string | null;
  is_available: number;
  position: number;
  created_at: number;
  updated_at: number;
}

export interface CreateProductVariantInput {
  id?: string;
  productId: string;
  title: string;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  inventoryQuantity?: number;
  trackInventory?: boolean;
  allowBackorder?: boolean;
  weight?: number | null;
  weightUnit?: string;
  requiresShipping?: boolean;
  taxable?: boolean;
  taxCode?: string | null;
  optionValues?: string[];
  imageId?: string | null;
  isAvailable?: boolean;
  position?: number;
}

export class ProductVariantRepository {
  async upsertMany(variants: CreateProductVariantInput[]): Promise<void> {
    const now = Date.now();
    for (const v of variants) {
      const id = v.id || generateUUID();
      await db.runAsync(
        `INSERT INTO product_variants (
          id, product_id, title, sku, barcode, price, compare_at_price, cost_price,
          inventory_quantity, track_inventory, allow_backorder, weight, weight_unit,
          requires_shipping, taxable, tax_code, option_values, image_id,
          is_available, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          sku = excluded.sku,
          barcode = excluded.barcode,
          price = excluded.price,
          compare_at_price = excluded.compare_at_price,
          cost_price = excluded.cost_price,
          inventory_quantity = excluded.inventory_quantity,
          track_inventory = excluded.track_inventory,
          allow_backorder = excluded.allow_backorder,
          weight = excluded.weight,
          weight_unit = excluded.weight_unit,
          requires_shipping = excluded.requires_shipping,
          taxable = excluded.taxable,
          tax_code = excluded.tax_code,
          option_values = excluded.option_values,
          image_id = excluded.image_id,
          is_available = excluded.is_available,
          position = excluded.position,
          updated_at = excluded.updated_at`,
        [
          id,
          v.productId,
          v.title,
          v.sku ?? null,
          v.barcode ?? null,
          v.price,
          v.compareAtPrice ?? null,
          v.costPrice ?? null,
          v.inventoryQuantity ?? 0,
          v.trackInventory !== false ? 1 : 0,
          v.allowBackorder ? 1 : 0,
          v.weight ?? null,
          v.weightUnit ?? 'g',
          v.requiresShipping !== false ? 1 : 0,
          v.taxable !== false ? 1 : 0,
          v.taxCode ?? null,
          JSON.stringify(v.optionValues ?? []),
          v.imageId ?? null,
          v.isAvailable !== false ? 1 : 0,
          v.position ?? 0,
          now,
          now,
        ]
      );
    }
  }

  async findByProductId(productId: string): Promise<ProductVariantRow[]> {
    return db.getAllAsync<ProductVariantRow>('SELECT * FROM product_variants WHERE product_id = ? ORDER BY position ASC', [productId]);
  }

  async findById(id: string): Promise<ProductVariantRow | null> {
    return db.getFirstAsync<ProductVariantRow>('SELECT * FROM product_variants WHERE id = ?', [id]);
  }

  async findBySku(sku: string): Promise<ProductVariantRow | null> {
    return db.getFirstAsync<ProductVariantRow>('SELECT * FROM product_variants WHERE sku = ?', [sku]);
  }

  async findByBarcode(barcode: string): Promise<ProductVariantRow | null> {
    return db.getFirstAsync<ProductVariantRow>('SELECT * FROM product_variants WHERE barcode = ?', [barcode]);
  }

  async updateInventory(id: string, quantity: number): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE product_variants SET inventory_quantity = ?, updated_at = ? WHERE id = ?', [quantity, now, id]);
  }

  async deleteByProductId(productId: string): Promise<void> {
    await db.runAsync('DELETE FROM product_variants WHERE product_id = ?', [productId]);
  }

  async delete(id: string): Promise<void> {
    await db.runAsync('DELETE FROM product_variants WHERE id = ?', [id]);
  }
}

export const productVariantRepository = new ProductVariantRepository();
