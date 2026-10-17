/**
 * LocalCustomerRepository
 *
 * Persistent local customer profiles — the authoritative source for
 * purchase history, loyalty, and store credit, independent of platform.
 *
 * Table: local_customers (created in dbSchema v6)
 */

import { db } from '../../../shared/utils/db';
import { generateUUID } from '../../../shared/utils/uuid';

export interface LocalCustomerRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notes: string | null;
  segment: string | null;
  total_orders: number;
  total_spend: number; // stored as dollars (REAL)
  created_at: number;
  updated_at: number;
}

export interface LocalCustomer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notes: string | null;
  segment: string | null;
  totalOrders: number;
  totalSpend: number;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertLocalCustomerInput {
  email: string;
  name?: string | null;
  phone?: string | null;
  notes?: string | null;
  segment?: string | null;
}

export interface UpdateLocalCustomerInput {
  name?: string | null;
  phone?: string | null;
  notes?: string | null;
  segment?: string | null;
}

function mapRow(row: LocalCustomerRow): LocalCustomer {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    segment: row.segment,
    totalOrders: row.total_orders,
    totalSpend: row.total_spend,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class LocalCustomerRepository {
  /**
   * Upsert a customer by email.
   * Creates a new row if none exists; updates name if provided and non-empty.
   * Returns the customer id.
   */
  async upsert(input: UpsertLocalCustomerInput): Promise<string> {
    const existing = await this.findByEmail(input.email);
    const now = Date.now();

    if (existing) {
      if (input.name && input.name.trim()) {
        await db.runAsync('UPDATE local_customers SET name = ?, updated_at = ? WHERE id = ?', [input.name.trim(), now, existing.id]);
      }
      return existing.id;
    }

    const id = generateUUID();
    await db.runAsync(
      `INSERT INTO local_customers
         (id, email, name, phone, notes, segment, total_orders, total_spend, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [
        id,
        input.email.toLowerCase().trim(),
        input.name?.trim() ?? null,
        input.phone ?? null,
        input.notes ?? null,
        input.segment ?? null,
        now,
        now,
      ]
    );
    return id;
  }

  async findByEmail(email: string): Promise<LocalCustomer | null> {
    const row = await db.getFirstAsync<LocalCustomerRow>('SELECT * FROM local_customers WHERE email = ?', [email.toLowerCase().trim()]);
    return row ? mapRow(row) : null;
  }

  async findById(id: string): Promise<LocalCustomer | null> {
    const row = await db.getFirstAsync<LocalCustomerRow>('SELECT * FROM local_customers WHERE id = ?', [id]);
    return row ? mapRow(row) : null;
  }

  async findAll(segment?: string): Promise<LocalCustomer[]> {
    const rows = segment
      ? await db.getAllAsync<LocalCustomerRow>('SELECT * FROM local_customers WHERE segment = ? ORDER BY name ASC', [segment])
      : await db.getAllAsync<LocalCustomerRow>('SELECT * FROM local_customers ORDER BY name ASC');
    return rows.map(mapRow);
  }

  async update(id: string, input: UpdateLocalCustomerInput): Promise<void> {
    const now = Date.now();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      values.push(input.name);
    }
    if (input.phone !== undefined) {
      fields.push('phone = ?');
      values.push(input.phone);
    }
    if (input.notes !== undefined) {
      fields.push('notes = ?');
      values.push(input.notes);
    }
    if (input.segment !== undefined) {
      fields.push('segment = ?');
      values.push(input.segment);
    }

    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    values.push(now, id);

    await db.runAsync(`UPDATE local_customers SET ${fields.join(', ')} WHERE id = ?`, values as (string | number | null)[]);
  }

  /** Increment order count and add to total spend after a completed order */
  async recordOrder(email: string, orderTotal: number): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `UPDATE local_customers
       SET total_orders = total_orders + 1,
           total_spend  = total_spend + ?,
           updated_at   = ?
       WHERE email = ?`,
      [orderTotal, now, email.toLowerCase().trim()]
    );
  }
}

export const localCustomerRepository = new LocalCustomerRepository();
