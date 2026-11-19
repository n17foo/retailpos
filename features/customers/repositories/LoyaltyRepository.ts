/**
 * LoyaltyRepository
 *
 * Append-only ledger for loyalty points.
 * Balances are always derived by summing the ledger — never stored as mutable fields.
 *
 * Tables: loyalty_accounts, loyalty_transactions (created in dbSchema v6)
 */

import { db } from '../../../shared/utils/db';
import { generateUUID } from '../../../shared/utils/uuid';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';
import { instoreApiLoyaltyRepository } from './InstoreApiLoyaltyRepository';

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'adjustment' | 'reversal' | 'expire';

export interface LoyaltyAccountRow {
  id: string;
  customer_email: string;
  balance: number; // current points balance (derived, kept for fast reads)
  lifetime_earned: number;
  tier: string | null;
  created_at: number;
  updated_at: number;
}

export interface LoyaltyTransactionRow {
  id: string;
  customer_email: string;
  type: LoyaltyTransactionType;
  points: number; // positive = earn/adjust-up, negative = redeem/adjust-down
  order_id: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: number;
  /** Set on 'reversal' rows — the transaction they undo. Unique per redemption (CUS-01). */
  reverses_id: string | null;
  /** Points of this earn lot already consumed by expiry passes (CUS-05). */
  expired_points: number;
}

/** Structural contract shared by local and Store API loyalty ledgers. */
export interface LoyaltyLedger {
  getAccount(email: string): Promise<LoyaltyAccountRow | null>;
  getOrCreateAccount(email: string): Promise<LoyaltyAccountRow>;
  updateBalance(email: string, delta: number): Promise<void>;
  updateTier(email: string, tier: string): Promise<void>;
  applyTransaction(
    email: string,
    type: LoyaltyTransactionType,
    points: number,
    orderId?: string | null,
    reason?: string | null,
    createdBy?: string | null,
    reversesId?: string | null
  ): Promise<string>;
  appendTransaction(
    email: string,
    type: LoyaltyTransactionType,
    points: number,
    orderId?: string | null,
    reason?: string | null,
    createdBy?: string | null,
    reversesId?: string | null
  ): Promise<string>;
  findTransactionsByEmail(email: string, limit?: number): Promise<LoyaltyTransactionRow[]>;
  findTransactionById(id: string): Promise<LoyaltyTransactionRow | null>;
  findCustomersWithExpiredTransactions(expiryThreshold: number): Promise<string[]>;
  findExpiredEarnTransactions(email: string, expiryThreshold: number): Promise<LoyaltyTransactionRow[]>;
  findEarnTransactionsBetween(email: string, expiryThreshold: number, warningThreshold: number): Promise<LoyaltyTransactionRow[]>;
  /**
   * Lot-aware points expiry (CUS-05): expires the remaining points of earn
   * lots older than `expiryThreshold` in one transaction — idempotent, so a
   * repeated pass cannot consume newly earned points. Local ledger only.
   */
  expireLots?(email: string, expiryThreshold: number, reason: string): Promise<{ lotsProcessed: number; pointsExpired: number }>;
}

export class LoyaltyRepository {
  // ── Account ───────────────────────────────────────────────────────────

  async getAccount(email: string): Promise<LoyaltyAccountRow | null> {
    return db.getFirstAsync<LoyaltyAccountRow>('SELECT * FROM loyalty_accounts WHERE customer_email = ?', [email.toLowerCase()]);
  }

  async getOrCreateAccount(email: string): Promise<LoyaltyAccountRow> {
    const existing = await this.getAccount(email);
    if (existing) return existing;

    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO loyalty_accounts (id, customer_email, balance, lifetime_earned, tier, created_at, updated_at)
       VALUES (?, ?, 0, 0, NULL, ?, ?)`,
      [id, email.toLowerCase(), now, now]
    );
    return (await this.getAccount(email))!;
  }

  async updateBalance(email: string, delta: number): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `UPDATE loyalty_accounts
       SET balance = MAX(0, balance + ?),
           lifetime_earned = CASE WHEN ? > 0 THEN lifetime_earned + ? ELSE lifetime_earned END,
           updated_at = ?
       WHERE customer_email = ?`,
      [delta, delta, delta, now, email.toLowerCase()]
    );
  }

  async updateTier(email: string, tier: string): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `UPDATE loyalty_accounts
       SET tier = ?,
           updated_at = ?
       WHERE customer_email = ?`,
      [tier, now, email.toLowerCase()]
    );
  }

  // ── Transactions ──────────────────────────────────────────────────────

  /**
   * Append a transaction AND apply its balance delta atomically. In client
   * mode this is one server call — locally the insert and the guarded
   * balance update commit or roll back together (CUS-04), and the update
   * is conditioned on not overdrawing the account (CUS-02).
   *
   * 'earn' transactions are idempotent per (customer, order): a retried
   * checkout/reconciliation replay returns the existing award's id
   * instead of awarding the same sale twice (CUS-03).
   */
  async applyTransaction(
    email: string,
    type: LoyaltyTransactionType,
    points: number,
    orderId?: string | null,
    reason?: string | null,
    createdBy?: string | null,
    reversesId?: string | null
  ): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    let committedId = id;
    await db.withTransactionAsync(async () => {
      if (type === 'earn' && orderId) {
        const existing = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM loyalty_transactions WHERE customer_email = ? AND order_id = ? AND type = 'earn'`,
          [email.toLowerCase(), orderId]
        );
        if (existing) {
          committedId = existing.id;
          return;
        }
      }
      await db.runAsync(
        `INSERT INTO loyalty_transactions
           (id, customer_email, type, points, order_id, reason, created_by, created_at, reverses_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, email.toLowerCase(), type, points, orderId ?? null, reason ?? null, createdBy ?? null, now, reversesId ?? null]
      );
      const res = await db.runAsync(
        `UPDATE loyalty_accounts
         SET balance = balance + ?,
             lifetime_earned = CASE WHEN ? > 0 THEN lifetime_earned + ? ELSE lifetime_earned END,
             updated_at = ?
         WHERE customer_email = ? AND balance + ? >= 0`,
        [points, points, points, now, email.toLowerCase(), points]
      );
      if (res.changes === 0) {
        throw new Error('Insufficient loyalty points balance');
      }
    });
    return committedId;
  }

  async appendTransaction(
    email: string,
    type: LoyaltyTransactionType,
    points: number,
    orderId?: string | null,
    reason?: string | null,
    createdBy?: string | null,
    reversesId?: string | null
  ): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO loyalty_transactions
         (id, customer_email, type, points, order_id, reason, created_by, created_at, reverses_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, email.toLowerCase(), type, points, orderId ?? null, reason ?? null, createdBy ?? null, now, reversesId ?? null]
    );
    return id;
  }

  async findTransactionsByEmail(email: string, limit = 50): Promise<LoyaltyTransactionRow[]> {
    return db.getAllAsync<LoyaltyTransactionRow>(
      'SELECT * FROM loyalty_transactions WHERE customer_email = ? ORDER BY created_at DESC LIMIT ?',
      [email.toLowerCase(), limit]
    );
  }

  async findTransactionById(id: string): Promise<LoyaltyTransactionRow | null> {
    return db.getFirstAsync<LoyaltyTransactionRow>('SELECT * FROM loyalty_transactions WHERE id = ?', [id]);
  }

  /**
   * Expire remaining points on earn lots older than expiryThreshold.
   *
   * Lot accounting replays the whole ledger in one transaction: each 'earn'
   * row is a lot; 'redeem' rows consume lots oldest-first (FIFO); 'reversal'
   * rows restore the lots their linked redemption consumed (legacy unlinked
   * reversals restore newest-first); each lot's `expired_points` column
   * records what earlier expiry passes already consumed. The pass therefore
   * expires only what is genuinely left — re-running it cannot consume
   * newly earned points (CUS-05).
   */
  async expireLots(email: string, expiryThreshold: number, reason: string): Promise<{ lotsProcessed: number; pointsExpired: number }> {
    const outcome = { lotsProcessed: 0, pointsExpired: 0 };
    await db.withTransactionAsync(async () => {
      const txns = await db.getAllAsync<LoyaltyTransactionRow>(
        `SELECT * FROM loyalty_transactions WHERE customer_email = ? ORDER BY created_at ASC, rowid ASC`,
        [email.toLowerCase()]
      );

      interface EarnLot {
        id: string;
        created_at: number;
        /** points - expired_points — the most the lot can still hold */
        cap: number;
        remaining: number;
      }
      const lotsById = new Map<string, EarnLot>();
      const orderedLots: EarnLot[] = [];
      // redeem tx id → the lots it consumed, so a reversal can restore them
      const redeemAllocations = new Map<string, { lotId: string; amount: number }[]>();

      for (const tx of txns) {
        if (tx.type === 'earn') {
          const cap = tx.points - (tx.expired_points ?? 0);
          const lot: EarnLot = { id: tx.id, created_at: tx.created_at, cap, remaining: cap };
          lotsById.set(tx.id, lot);
          orderedLots.push(lot);
        } else if (tx.type === 'redeem') {
          let toConsume = -tx.points;
          const allocation: { lotId: string; amount: number }[] = [];
          for (const lot of orderedLots) {
            if (toConsume <= 0) break;
            const take = Math.min(lot.remaining, toConsume);
            if (take > 0) {
              lot.remaining -= take;
              allocation.push({ lotId: lot.id, amount: take });
              toConsume -= take;
            }
          }
          redeemAllocations.set(tx.id, allocation);
        } else if (tx.type === 'reversal') {
          let restore = tx.points;
          const linked = tx.reverses_id ? redeemAllocations.get(tx.reverses_id) : undefined;
          if (linked) {
            for (const { lotId, amount } of linked) {
              if (restore <= 0) break;
              const lot = lotsById.get(lotId);
              if (!lot) continue;
              const give = Math.min(amount, lot.cap - lot.remaining);
              lot.remaining += give;
              restore -= give;
            }
          }
          // Unlinked legacy reversal or leftover: restore newest-first, capped
          for (let i = orderedLots.length - 1; i >= 0 && restore > 0; i--) {
            const lot = orderedLots[i];
            const give = Math.min(restore, lot.cap - lot.remaining);
            lot.remaining += give;
            restore -= give;
          }
        }
      }

      const expiredLots = orderedLots.filter(l => l.created_at < expiryThreshold && l.remaining > 0);
      const expirable = expiredLots.reduce((s, l) => s + l.remaining, 0);
      if (expirable <= 0) return;

      const account = await db.getFirstAsync<{ balance: number }>('SELECT balance FROM loyalty_accounts WHERE customer_email = ?', [
        email.toLowerCase(),
      ]);
      let toExpire = Math.min(expirable, Math.max(0, account?.balance ?? 0));
      if (toExpire <= 0) return;

      const expireId = generateUUID();
      await db.runAsync(
        `INSERT INTO loyalty_transactions
           (id, customer_email, type, points, order_id, reason, created_by, created_at, reverses_id)
         VALUES (?, ?, 'expire', ?, NULL, ?, 'system', ?, NULL)`,
        [expireId, email.toLowerCase(), -toExpire, reason, Date.now()]
      );

      // Mark each expired lot — oldest first — so the pass is idempotent.
      for (const lot of expiredLots) {
        if (toExpire <= 0) break;
        const take = Math.min(lot.remaining, toExpire);
        await db.runAsync('UPDATE loyalty_transactions SET expired_points = expired_points + ? WHERE id = ?', [take, lot.id]);
        toExpire -= take;
        outcome.lotsProcessed++;
        outcome.pointsExpired += take;
      }

      // Guarded balance debit in the same transaction (CUS-04).
      const res = await db.runAsync(
        `UPDATE loyalty_accounts
         SET balance = balance - ?, updated_at = ?
         WHERE customer_email = ? AND balance - ? >= 0`,
        [outcome.pointsExpired, Date.now(), email.toLowerCase(), outcome.pointsExpired]
      );
      if (res.changes === 0) {
        throw new Error('Insufficient loyalty points balance');
      }
    });
    return outcome;
  }

  // ── Expiry Support ────────────────────────────────────────────────────

  /**
   * Find all customers who have earn transactions older than the threshold.
   * Used by the expiry job to identify customers with potentially expired points.
   */
  async findCustomersWithExpiredTransactions(expiryThreshold: number): Promise<string[]> {
    const rows = await db.getAllAsync<{ customer_email: string }>(
      `SELECT DISTINCT customer_email
       FROM loyalty_transactions
       WHERE type = 'earn' AND created_at < ? AND points > COALESCE(expired_points, 0)`,
      [expiryThreshold]
    );
    return rows.map(row => row.customer_email);
  }

  /**
   * Find all earn transactions for a customer that are older than the threshold.
   * These are the transactions whose points should be expired.
   */
  async findExpiredEarnTransactions(email: string, expiryThreshold: number): Promise<LoyaltyTransactionRow[]> {
    return db.getAllAsync<LoyaltyTransactionRow>(
      `SELECT * FROM loyalty_transactions 
       WHERE customer_email = ? 
         AND type = 'earn' 
         AND created_at < ?
       ORDER BY created_at ASC`,
      [email.toLowerCase(), expiryThreshold]
    );
  }

  /**
   * Find earn transactions that will expire soon (between expiry threshold and warning threshold).
   * Used to warn customers about upcoming expiry.
   */
  async findEarnTransactionsBetween(email: string, expiryThreshold: number, warningThreshold: number): Promise<LoyaltyTransactionRow[]> {
    return db.getAllAsync<LoyaltyTransactionRow>(
      `SELECT * FROM loyalty_transactions 
       WHERE customer_email = ? 
         AND type = 'earn' 
         AND created_at < ? 
         AND created_at >= ?
       ORDER BY created_at ASC`,
      [email.toLowerCase(), warningThreshold, expiryThreshold]
    );
  }
}

export const loyaltyRepository = new LoyaltyRepository();

/**
 * Returns the authoritative loyalty repository for the current register mode:
 * the Store API in multi-register client mode, local SQLite otherwise.
 * Resolved at call time — instoreApiConfig finishes loading async.
 */
export const getLoyaltyRepository = (): LoyaltyLedger => {
  return instoreApiConfig.isClient ? instoreApiLoyaltyRepository : loyaltyRepository;
};
