/**
 * StoreCreditRepository
 *
 * Append-only ledger for store credit.
 * All amounts stored as integer cents (per ADR-006).
 * Balance is always derived by summing the ledger.
 *
 * Table: store_credit_ledger (created in dbSchema v6, reverses_id added v16)
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
  /** Set on 'reversal' rows — the entry they undo. Unique per redemption (CUS-01). */
  reverses_id: string | null;
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
    createdBy?: string | null,
    reversesId?: string | null
  ): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO store_credit_ledger
         (id, customer_email, type, amount_cents, order_id, reason, created_by, created_at, reverses_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, email.toLowerCase(), type, amountCents, orderId ?? null, reason ?? null, createdBy ?? null, now, reversesId ?? null]
    );
    return id;
  }

  /**
   * Balance check and debit as ONE transaction — the running balance is
   * re-read inside the transaction and the insert only happens when the
   * clamped redemption is positive, so two concurrent redemptions cannot
   * both pass the check and overspend the account (CUS-02).
   */
  async redeemIfSufficient(
    email: string,
    requestedCents: number,
    orderId?: string | null
  ): Promise<{ entryId: string; redeemedCents: number }> {
    let result: { entryId: string; redeemedCents: number } | null = null;
    await db.withTransactionAsync(async () => {
      const { total } = (await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(amount_cents), 0) as total FROM store_credit_ledger WHERE customer_email = ?',
        [email.toLowerCase()]
      ))!;
      const redeemedCents = Math.min(requestedCents, Math.max(0, total));
      if (redeemedCents <= 0) {
        throw new Error('Insufficient store credit balance');
      }
      const entryId = generateUUID();
      await db.runAsync(
        `INSERT INTO store_credit_ledger
           (id, customer_email, type, amount_cents, order_id, reason, created_by, created_at, reverses_id)
         VALUES (?, ?, 'redeem', ?, ?, 'Store credit redemption', NULL, ?, NULL)`,
        [entryId, email.toLowerCase(), -redeemedCents, orderId ?? null, Date.now()]
      );
      result = { entryId, redeemedCents };
    });
    return result!;
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
