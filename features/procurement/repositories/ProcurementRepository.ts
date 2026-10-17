/**
 * ProcurementRepository
 *
 * SQLite persistence for vendors, purchase orders, purchase order items,
 * inventory counts, inventory count items, transfer orders, transfer order
 * items, product inventory config (reorder points), and vendor returns.
 *
 * Tables created in dbSchema v7.
 */

import { db } from '../../../shared/utils/db';
import { generateUUID } from '../../../shared/utils/uuid';

// ── Vendor ────────────────────────────────────────────────────────────────

export interface VendorRow {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface CreateVendorInput {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

// ── Purchase Order ────────────────────────────────────────────────────────

export type POStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrderRow {
  id: string;
  vendor_id: string | null;
  status: POStatus;
  expected_date: number | null;
  notes: string | null;
  ordered_at: number | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface PurchaseOrderItemRow {
  id: string;
  purchase_order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
}

export interface CreatePOInput {
  vendorId?: string | null;
  expectedDate?: number | null;
  notes?: string | null;
  createdBy?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    productName: string;
    orderedQty: number;
    unitCost: number;
  }>;
}

// ── Inventory Count ───────────────────────────────────────────────────────

export type CountStatus = 'in_progress' | 'completed' | 'discarded';

export interface InventoryCountRow {
  id: string;
  status: CountStatus;
  started_by: string | null;
  started_at: number;
  completed_at: number | null;
  notes: string | null;
}

export interface InventoryCountItemRow {
  id: string;
  count_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  expected_qty: number;
  counted_qty: number | null;
}

// ── Transfer Order ────────────────────────────────────────────────────────

export type TransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled';

export interface TransferOrderRow {
  id: string;
  from_location: string;
  to_location: string;
  status: TransferStatus;
  notes: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface TransferOrderItemRow {
  id: string;
  transfer_order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  transfer_qty: number;
}

// ── Product Inventory Config (reorder points) ─────────────────────────────

export interface ProductInventoryConfigRow {
  product_id: string;
  variant_id: string | null;
  reorder_point: number;
  reorder_qty: number;
  default_vendor_id: string | null;
  updated_at: number;
}

// ── Vendor Return ─────────────────────────────────────────────────────────

export type VendorReturnStatus = 'pending' | 'confirmed' | 'cancelled';

export interface VendorReturnRow {
  id: string;
  purchase_order_id: string;
  vendor_id: string;
  status: VendorReturnStatus;
  notes: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface VendorReturnItemRow {
  id: string;
  vendor_return_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  return_qty: number;
  reason: string | null;
}

// ── Repository ────────────────────────────────────────────────────────────

export class ProcurementRepository {
  // ── Vendors ───────────────────────────────────────────────────────────

  async createVendor(input: CreateVendorInput): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO vendors (id, name, contact_name, email, phone, address, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.contactName ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.address ?? null,
        input.notes ?? null,
        now,
        now,
      ]
    );
    return id;
  }

  async findAllVendors(): Promise<VendorRow[]> {
    return db.getAllAsync<VendorRow>('SELECT * FROM vendors WHERE deleted_at IS NULL ORDER BY name ASC');
  }

  async findVendorById(id: string): Promise<VendorRow | null> {
    return db.getFirstAsync<VendorRow>('SELECT * FROM vendors WHERE id = ?', [id]);
  }

  async updateVendor(id: string, input: Partial<CreateVendorInput>): Promise<void> {
    const now = Date.now();
    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.name !== undefined) {
      fields.push('name = ?');
      values.push(input.name);
    }
    if (input.contactName !== undefined) {
      fields.push('contact_name = ?');
      values.push(input.contactName);
    }
    if (input.email !== undefined) {
      fields.push('email = ?');
      values.push(input.email);
    }
    if (input.phone !== undefined) {
      fields.push('phone = ?');
      values.push(input.phone);
    }
    if (input.address !== undefined) {
      fields.push('address = ?');
      values.push(input.address);
    }
    if (input.notes !== undefined) {
      fields.push('notes = ?');
      values.push(input.notes);
    }
    if (!fields.length) return;
    fields.push('updated_at = ?');
    values.push(now, id);
    await db.runAsync(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`, values as (string | number | null)[]);
  }

  async softDeleteVendor(id: string): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE vendors SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
  }

  // ── Purchase Orders ───────────────────────────────────────────────────

  async createPO(input: CreatePOInput): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO purchase_orders (id, vendor_id, status, expected_date, notes, created_by, created_at, updated_at)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?)`,
      [id, input.vendorId ?? null, input.expectedDate ?? null, input.notes ?? null, input.createdBy ?? null, now, now]
    );
    for (const item of input.items) {
      const itemId = generateUUID();
      await db.runAsync(
        `INSERT INTO purchase_order_items
           (id, purchase_order_id, product_id, variant_id, product_name, ordered_qty, received_qty, unit_cost)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [itemId, id, item.productId, item.variantId ?? null, item.productName, item.orderedQty, item.unitCost]
      );
    }
    return id;
  }

  async findAllPOs(status?: POStatus): Promise<PurchaseOrderRow[]> {
    if (status) {
      return db.getAllAsync<PurchaseOrderRow>('SELECT * FROM purchase_orders WHERE status = ? ORDER BY created_at DESC', [status]);
    }
    return db.getAllAsync<PurchaseOrderRow>('SELECT * FROM purchase_orders ORDER BY created_at DESC');
  }

  async findPOById(id: string): Promise<PurchaseOrderRow | null> {
    return db.getFirstAsync<PurchaseOrderRow>('SELECT * FROM purchase_orders WHERE id = ?', [id]);
  }

  async findPOItems(purchaseOrderId: string): Promise<PurchaseOrderItemRow[]> {
    return db.getAllAsync<PurchaseOrderItemRow>('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [purchaseOrderId]);
  }

  async updatePOStatus(id: string, status: POStatus, orderedAt?: number): Promise<void> {
    const now = Date.now();
    if (orderedAt !== undefined) {
      await db.runAsync('UPDATE purchase_orders SET status = ?, ordered_at = ?, updated_at = ? WHERE id = ?', [status, orderedAt, now, id]);
    } else {
      await db.runAsync('UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
    }
  }

  async incrementReceivedQty(itemId: string, qty: number): Promise<void> {
    const now = Date.now();
    await db.runAsync(`UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE id = ?`, [qty, itemId]);
    // Touch parent PO updated_at
    const item = await db.getFirstAsync<{ purchase_order_id: string }>('SELECT purchase_order_id FROM purchase_order_items WHERE id = ?', [
      itemId,
    ]);
    if (item) {
      await db.runAsync('UPDATE purchase_orders SET updated_at = ? WHERE id = ?', [now, item.purchase_order_id]);
    }
  }

  // ── Inventory Counts ──────────────────────────────────────────────────

  async createCount(startedBy?: string | null, notes?: string | null): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO inventory_counts (id, status, started_by, started_at, notes)
       VALUES (?, 'in_progress', ?, ?, ?)`,
      [id, startedBy ?? null, now, notes ?? null]
    );
    return id;
  }

  async findCountById(id: string): Promise<InventoryCountRow | null> {
    return db.getFirstAsync<InventoryCountRow>('SELECT * FROM inventory_counts WHERE id = ?', [id]);
  }

  async findAllCounts(): Promise<InventoryCountRow[]> {
    return db.getAllAsync<InventoryCountRow>('SELECT * FROM inventory_counts ORDER BY started_at DESC');
  }

  async updateCountStatus(id: string, status: CountStatus, completedAt?: number): Promise<void> {
    if (completedAt !== undefined) {
      await db.runAsync('UPDATE inventory_counts SET status = ?, completed_at = ? WHERE id = ?', [status, completedAt, id]);
    } else {
      await db.runAsync('UPDATE inventory_counts SET status = ? WHERE id = ?', [status, id]);
    }
  }

  async addCountItem(
    countId: string,
    productId: string,
    variantId: string | null,
    productName: string,
    sku: string | null,
    expectedQty: number
  ): Promise<string> {
    const id = generateUUID();
    await db.runAsync(
      `INSERT INTO inventory_count_items
         (id, count_id, product_id, variant_id, product_name, sku, expected_qty, counted_qty)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      [id, countId, productId, variantId, productName, sku, expectedQty]
    );
    return id;
  }

  async findCountItems(countId: string): Promise<InventoryCountItemRow[]> {
    return db.getAllAsync<InventoryCountItemRow>('SELECT * FROM inventory_count_items WHERE count_id = ?', [countId]);
  }

  async updateCountedQty(itemId: string, countedQty: number): Promise<void> {
    await db.runAsync('UPDATE inventory_count_items SET counted_qty = ? WHERE id = ?', [countedQty, itemId]);
  }

  // ── Transfer Orders ───────────────────────────────────────────────────

  async createTransferOrder(
    fromLocation: string,
    toLocation: string,
    notes: string | null,
    createdBy: string | null,
    items: Array<{ productId: string; variantId?: string | null; productName: string; transferQty: number }>
  ): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO transfer_orders (id, from_location, to_location, status, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [id, fromLocation, toLocation, notes, createdBy, now, now]
    );
    for (const item of items) {
      const itemId = generateUUID();
      await db.runAsync(
        `INSERT INTO transfer_order_items (id, transfer_order_id, product_id, variant_id, product_name, transfer_qty)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [itemId, id, item.productId, item.variantId ?? null, item.productName, item.transferQty]
      );
    }
    return id;
  }

  async findTransferOrderById(id: string): Promise<TransferOrderRow | null> {
    return db.getFirstAsync<TransferOrderRow>('SELECT * FROM transfer_orders WHERE id = ?', [id]);
  }

  async findAllTransferOrders(status?: TransferStatus): Promise<TransferOrderRow[]> {
    if (status) {
      return db.getAllAsync<TransferOrderRow>('SELECT * FROM transfer_orders WHERE status = ? ORDER BY created_at DESC', [status]);
    }
    return db.getAllAsync<TransferOrderRow>('SELECT * FROM transfer_orders ORDER BY created_at DESC');
  }

  async findTransferOrderItems(transferOrderId: string): Promise<TransferOrderItemRow[]> {
    return db.getAllAsync<TransferOrderItemRow>('SELECT * FROM transfer_order_items WHERE transfer_order_id = ?', [transferOrderId]);
  }

  async updateTransferOrderStatus(id: string, status: TransferStatus): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE transfer_orders SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  }

  // ── Product Inventory Config ──────────────────────────────────────────

  async upsertInventoryConfig(
    productId: string,
    variantId: string | null,
    reorderPoint: number,
    reorderQty: number,
    defaultVendorId?: string | null
  ): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO product_inventory_config
         (product_id, variant_id, reorder_point, reorder_qty, default_vendor_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(product_id, COALESCE(variant_id, ''))
       DO UPDATE SET reorder_point = excluded.reorder_point,
                     reorder_qty   = excluded.reorder_qty,
                     default_vendor_id = excluded.default_vendor_id,
                     updated_at    = excluded.updated_at`,
      [productId, variantId ?? null, reorderPoint, reorderQty, defaultVendorId ?? null, now]
    );
  }

  async findInventoryConfig(productId: string, variantId?: string | null): Promise<ProductInventoryConfigRow | null> {
    return db.getFirstAsync<ProductInventoryConfigRow>(
      "SELECT * FROM product_inventory_config WHERE product_id = ? AND COALESCE(variant_id, '') = COALESCE(?, '')",
      [productId, variantId ?? null]
    );
  }

  async findAllInventoryConfigs(): Promise<ProductInventoryConfigRow[]> {
    return db.getAllAsync<ProductInventoryConfigRow>('SELECT * FROM product_inventory_config');
  }

  // ── Vendor Returns ────────────────────────────────────────────────────

  async createVendorReturn(
    purchaseOrderId: string,
    vendorId: string,
    notes: string | null,
    createdBy: string | null,
    items: Array<{ productId: string; variantId?: string | null; productName: string; returnQty: number; reason?: string | null }>
  ): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO vendor_returns (id, purchase_order_id, vendor_id, status, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [id, purchaseOrderId, vendorId, notes, createdBy, now, now]
    );
    for (const item of items) {
      const itemId = generateUUID();
      await db.runAsync(
        `INSERT INTO vendor_return_items (id, vendor_return_id, product_id, variant_id, product_name, return_qty, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [itemId, id, item.productId, item.variantId ?? null, item.productName, item.returnQty, item.reason ?? null]
      );
    }
    return id;
  }

  async findVendorReturnById(id: string): Promise<VendorReturnRow | null> {
    return db.getFirstAsync<VendorReturnRow>('SELECT * FROM vendor_returns WHERE id = ?', [id]);
  }

  async findAllVendorReturns(status?: VendorReturnStatus): Promise<VendorReturnRow[]> {
    if (status) {
      return db.getAllAsync<VendorReturnRow>('SELECT * FROM vendor_returns WHERE status = ? ORDER BY created_at DESC', [status]);
    }
    return db.getAllAsync<VendorReturnRow>('SELECT * FROM vendor_returns ORDER BY created_at DESC');
  }

  async findVendorReturnItems(vendorReturnId: string): Promise<VendorReturnItemRow[]> {
    return db.getAllAsync<VendorReturnItemRow>('SELECT * FROM vendor_return_items WHERE vendor_return_id = ?', [vendorReturnId]);
  }

  async updateVendorReturnStatus(id: string, status: VendorReturnStatus): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE vendor_returns SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  }
}

export const procurementRepository = new ProcurementRepository();
