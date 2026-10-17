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

  async appendTransaction(
    email: string,
    type: LoyaltyTransactionType,
    points: number,
    orderId?: string | null,
    reason?: string | null,
    createdBy?: string | null
  ): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO loyalty_transactions
         (id, customer_email, type, points, order_id, reason, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, email.toLowerCase(), type, points, orderId ?? null, reason ?? null, createdBy ?? null, now]
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

  // ── Expiry Support ────────────────────────────────────────────────────

  /**
   * Find all customers who have earn transactions older than the threshold.
   * Used by the expiry job to identify customers with potentially expired points.
   */
  async findCustomersWithExpiredTransactions(expiryThreshold: number): Promise<string[]> {
    const rows = await db.getAllAsync<{ customer_email: string }>(
      `SELECT DISTINCT customer_email 
       FROM loyalty_transactions 
       WHERE type = 'earn' AND created_at < ?`,
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
