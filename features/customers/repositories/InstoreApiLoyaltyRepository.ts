import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import type { LoyaltyAccountRow, LoyaltyTransactionRow, LoyaltyTransactionType, LoyaltyLedger } from './LoyaltyRepository';

/**
 * Store API-backed loyalty ledger — the server is authoritative in
 * multi-register deployments, so balances can't diverge across registers.
 *
 * Differences from the local repository:
 *   - applyTransaction appends the transaction AND applies the delta in one
 *     server-side atomic call; a redemption that would overdraw is rejected
 *     (HTTP 409), preventing double-spending across registers.
 *   - updateBalance alone is a no-op — balances only move via transactions.
 */
export class InstoreApiLoyaltyRepository implements LoyaltyLedger {
  async getAccount(email: string): Promise<LoyaltyAccountRow | null> {
    const raw = await instoreApiClient.getLoyaltyAccount(email);
    if (!raw) return null;
    const acc = raw as Omit<LoyaltyAccountRow, 'id'>;
    return { ...acc, id: acc.customer_email };
  }

  async getOrCreateAccount(email: string): Promise<LoyaltyAccountRow> {
    const existing = await this.getAccount(email);
    if (existing) return existing;
    const raw = await instoreApiClient.setLoyaltyTier(email, null);
    const acc = raw as Omit<LoyaltyAccountRow, 'id'>;
    return { ...acc, id: acc.customer_email };
  }

  /** No-op — balances only change via applyTransaction (atomic server-side). */
  async updateBalance(_email: string, _delta: number): Promise<void> {}

  async updateTier(email: string, tier: string): Promise<void> {
    await instoreApiClient.setLoyaltyTier(email, tier);
  }

  async applyTransaction(
    email: string,
    type: LoyaltyTransactionType,
    points: number,
    orderId?: string | null,
    reason?: string | null,
    createdBy?: string | null
  ): Promise<string> {
    const result = await instoreApiClient.appendLoyaltyTransaction({
      customer_email: email,
      type,
      points,
      order_id: orderId ?? null,
      reason: reason ?? null,
      created_by: createdBy ?? null,
    });
    return (result.transaction as LoyaltyTransactionRow).id;
  }

  /** Prefer applyTransaction — this alias keeps the interface surface. */
  async appendTransaction(
    email: string,
    type: LoyaltyTransactionType,
    points: number,
    orderId?: string | null,
    reason?: string | null,
    createdBy?: string | null
  ): Promise<string> {
    return this.applyTransaction(email, type, points, orderId, reason, createdBy);
  }

  async findTransactionsByEmail(email: string, limit = 50): Promise<LoyaltyTransactionRow[]> {
    const rows = await instoreApiClient.getLoyaltyTransactions(email, { limit });
    return rows as LoyaltyTransactionRow[];
  }

  async findTransactionById(id: string): Promise<LoyaltyTransactionRow | null> {
    const row = await instoreApiClient.getLoyaltyTransaction(id);
    return (row as LoyaltyTransactionRow | null) ?? null;
  }

  /** Not needed client-side — expiry runs on the server via /api/loyalty/expire. */
  async findCustomersWithExpiredTransactions(_expiryThreshold: number): Promise<string[]> {
    return [];
  }

  async findExpiredEarnTransactions(email: string, expiryThreshold: number): Promise<LoyaltyTransactionRow[]> {
    const rows = await instoreApiClient.getLoyaltyTransactions(email, { type: 'earn', before: expiryThreshold, limit: 1000 });
    return rows as LoyaltyTransactionRow[];
  }

  async findEarnTransactionsBetween(email: string, expiryThreshold: number, warningThreshold: number): Promise<LoyaltyTransactionRow[]> {
    const rows = await instoreApiClient.getLoyaltyTransactions(email, {
      type: 'earn',
      before: expiryThreshold,
      after: warningThreshold,
      limit: 1000,
    });
    return rows as LoyaltyTransactionRow[];
  }
}

export const instoreApiLoyaltyRepository = new InstoreApiLoyaltyRepository();
