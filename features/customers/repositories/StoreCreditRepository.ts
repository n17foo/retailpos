/**
 * StoreCreditRepository
 *
 * Append-only ledger for store credit.
 * All amounts stored as integer cents (per ADR-006).
 * Balance is always derived by summing the ledger.
 *
 * Table: store_credit_ledger (created in dbSchema v6)
 */

import { db } from '../../../shared/utils/db';
import { generateUUID } from '../../../shared/utils/uuid';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';
import { instoreApiStoreCreditRepository, StoreCreditLedger } from './InstoreApiStoreCreditRepository';

export type StoreCreditEntryType = 'issue' | 'redeem' | 'expire' | 'reversal';

export interface StoreCreditEntryRow {
  id: string;
  customer_email: string;
  type: StoreCreditEntryType;
  amount_cents: number; // positive = issue, negative = redeem/expire
  order_id: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: number;
}

export class StoreCreditRepository {
  async getBalanceCents(email: string): Promise<number> {
    const result = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount_cents), 0) as total FROM store_credit_ledger WHERE customer_email = ?',
      [email.toLowerCase()]
    );
    return Math.max(0, result?.total ?? 0);
  }

  async appendEntry(
    email: string,
    type: StoreCreditEntryType,
    amountCents: number,
    orderId?: string | null,
    reason?: string | null,
    createdBy?: string | null
  ): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO store_credit_ledger
         (id, customer_email, type, amount_cents, order_id, reason, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, email.toLowerCase(), type, amountCents, orderId ?? null, reason ?? null, createdBy ?? null, now]
    );
    return id;
  }

  async findEntriesByEmail(email: string, limit = 50): Promise<StoreCreditEntryRow[]> {
    return db.getAllAsync<StoreCreditEntryRow>(
      'SELECT * FROM store_credit_ledger WHERE customer_email = ? ORDER BY created_at DESC LIMIT ?',
      [email.toLowerCase(), limit]
    );
  }

  async findEntryById(id: string): Promise<StoreCreditEntryRow | null> {
    return db.getFirstAsync<StoreCreditEntryRow>('SELECT * FROM store_credit_ledger WHERE id = ?', [id]);
  }
}

export const storeCreditRepository = new StoreCreditRepository();

/**
 * Returns the authoritative store-credit ledger for the current register
 * mode: Store API in client mode, local SQLite otherwise. Resolved at call
 * time — instoreApiConfig finishes loading async.
 */
export const getStoreCreditRepository = (): StoreCreditLedger => {
  return instoreApiConfig.isClient ? instoreApiStoreCreditRepository : storeCreditRepository;
};
