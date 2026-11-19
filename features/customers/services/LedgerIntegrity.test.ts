/**
 * CUS-01/02/04/05 regression tests on real SQLite.
 *
 * CUS-01 — a repeated reversal must not mint credit: the ledger enforces one
 *          reversal per redemption via a unique reverses_id.
 * CUS-02 — concurrent redemptions must not overspend: the balance check and
 *          debit are one serialized transaction.
 * CUS-04 — the ledger insert and the balance update are atomic: a failed
 *          debit leaves no transaction row behind.
 * CUS-05 — expiry consumes the remaining points of each earn lot once:
 *          re-running it cannot drain newly earned points.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => {
  const { openDb } = require('../../../tests/helpers/nodeSqliteAdapter');
  const real = openDb();
  return {
    openDatabaseAsync: jest.fn(async () => real),
    openDatabaseSync: jest.fn(() => real),
  };
});

let uuidCounter = 0;
jest.mock('../../../shared/utils/uuid', () => ({
  generateUUID: () => `mock-uuid-${++uuidCounter}`,
}));

jest.mock('../../../shared/services/audit/AuditLogService', () => ({
  auditLogService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../shared/services/notifications/NotificationService', () => ({
  notificationService: { notify: jest.fn() },
}));

import { db } from '../../../shared/utils/db';
import { initializeSchema } from '../../../shared/utils/dbSchema';
import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';
import { loyaltyRepository } from '../repositories/LoyaltyRepository';
import { storeCreditService } from './customer/StoreCreditService';
import { loyaltyService } from './loyalty/LoyaltyService';

const realDb = db as unknown as SQLiteDatabase;
const EMAIL = 'cust@example.com';

describe('Ledger integrity (CUS-01/02/04/05)', () => {
  beforeEach(async () => {
    await initializeSchema(realDb);
    await realDb.runAsync('DELETE FROM store_credit_ledger');
    await realDb.runAsync('DELETE FROM loyalty_transactions');
    await realDb.runAsync('DELETE FROM loyalty_accounts');
    await realDb.runAsync('DELETE FROM key_value_store');
    jest.clearAllMocks();
    // loyaltyService caches its config — reseed it each test
    await keyValueRepository.setObject('loyalty.config', { enabled: true, earnRate: 100, redeemRate: 1, expiryDays: 1 });
  });

  describe('CUS-01 — reversal idempotency', () => {
    it('reversing a store-credit redemption twice restores it only once', async () => {
      await storeCreditService.issue(EMAIL, 1000, 'test issue');
      const { entryId } = await storeCreditService.redeem(EMAIL, 'ord-1', 200);

      await storeCreditService.reverseRedemption(entryId);
      await storeCreditService.reverseRedemption(entryId);
      await storeCreditService.reverseRedemption(entryId);

      // 1000 issued − 200 redeemed + 200 restored exactly once = 1000
      expect(await storeCreditService.getBalanceCents(EMAIL)).toBe(1000);
    });

    it('reversing a loyalty redemption twice restores the points only once', async () => {
      await loyaltyService.earnPoints(EMAIL, 'ord-1', 10); // 10.00 → 1000pts/100c... earnRate=100 → 1000c/100 = 10 pts
      const { transactionId } = await loyaltyService.redeemPoints(EMAIL, 'ord-2', 5);

      await loyaltyService.reverseRedemption(transactionId);
      await loyaltyService.reverseRedemption(transactionId);

      const balance = await loyaltyService.getBalance(EMAIL);
      expect(balance.points).toBe(10);
    });
  });

  describe('CUS-02 — concurrent redemptions cannot overspend', () => {
    it('two parallel 800¢ redemptions against a 1000¢ balance cannot overdraw', async () => {
      await storeCreditService.issue(EMAIL, 1000, 'test issue');

      const results = await Promise.allSettled([
        storeCreditService.redeem(EMAIL, 'ord-a', 800),
        storeCreditService.redeem(EMAIL, 'ord-b', 800),
      ]);

      // Each debit re-reads the balance inside its own transaction — the
      // combined redeemed amount can never exceed what was issued.
      const redeemed = results
        .filter(
          (r): r is PromiseFulfilledResult<{ entryId: string; redeemedCents: number; discountDollars: number }> => r.status === 'fulfilled'
        )
        .reduce((s, r) => s + r.value.redeemedCents, 0);
      expect(redeemed).toBeLessThanOrEqual(1000);
      // The account can never go negative regardless of interleaving
      expect(await storeCreditService.getBalanceCents(EMAIL)).toBe(1000 - redeemed);
    });

    it('two parallel loyalty redemptions cannot overdraw the account', async () => {
      await loyaltyService.earnPoints(EMAIL, 'ord-1', 10); // 10.00 → 10 points
      await loyaltyService.earnPoints(EMAIL, 'ord-2', 10); // +10 → 20 total

      const results = await Promise.allSettled([
        loyaltyService.redeemPoints(EMAIL, 'ord-a', 15),
        loyaltyService.redeemPoints(EMAIL, 'ord-b', 15),
      ]);

      const redeemedDollars = results
        .filter((r): r is PromiseFulfilledResult<{ transactionId: string; discountDollars: number }> => r.status === 'fulfilled')
        .reduce((s, r) => s + r.value.discountDollars, 0);
      // 20 points at 1¢/point → at most $0.20 may be redeemed in total
      expect(redeemedDollars).toBeLessThanOrEqual(0.2);
      expect((await loyaltyService.getBalance(EMAIL)).points).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CUS-04 — ledger insert and balance update are atomic', () => {
    it('a rejected debit leaves no transaction row and no balance change', async () => {
      await loyaltyService.earnPoints(EMAIL, 'ord-1', 10);
      const before = (await loyaltyService.getBalance(EMAIL)).points;

      await expect(loyaltyRepository.applyTransaction(EMAIL, 'redeem', -(before + 100), null, 'overdraft attempt')).rejects.toThrow(
        /Insufficient/
      );

      // The insert rolled back with the guarded balance update
      const txns = await loyaltyRepository.findTransactionsByEmail(EMAIL);
      expect(txns.filter(t => t.reason === 'overdraft attempt')).toHaveLength(0);
      expect((await loyaltyService.getBalance(EMAIL)).points).toBe(before);
    });

    it('a duplicate reversal fails atomically — no balance change on the second attempt', async () => {
      await loyaltyService.earnPoints(EMAIL, 'ord-1', 10);
      const { transactionId } = await loyaltyService.redeemPoints(EMAIL, 'ord-2', 5);

      // First reversal applies
      await loyaltyRepository.applyTransaction(EMAIL, 'reversal', 5, 'ord-2', 'Reversal of ' + transactionId, 'system', transactionId);
      expect((await loyaltyService.getBalance(EMAIL)).points).toBe(10);

      // Second reversal of the same redemption violates the unique constraint
      // and rolls back insert + balance update together
      await expect(
        loyaltyRepository.applyTransaction(EMAIL, 'reversal', 5, 'ord-2', 'Reversal of ' + transactionId, 'system', transactionId)
      ).rejects.toThrow(/UNIQUE/);
      expect((await loyaltyService.getBalance(EMAIL)).points).toBe(10);
    });
  });

  describe('CUS-05 — expiry is idempotent and lot-aware', () => {
    it('a repeated expiry pass cannot consume newly earned points', async () => {
      // Earn 100 points (10.00 at 100¢/point × 10 orders of 10.00 → use direct ledger)
      const account = await loyaltyRepository.getOrCreateAccount(EMAIL);
      void account;
      await loyaltyRepository.applyTransaction(EMAIL, 'earn', 100, 'ord-old', 'Order purchase');

      // Age the earn beyond the 1-day expiry window
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      await realDb.runAsync('UPDATE loyalty_transactions SET created_at = ? WHERE customer_email = ? AND type = ?', [
        twoDaysAgo,
        EMAIL,
        'earn',
      ]);

      const first = await loyaltyService.expireOldPoints(EMAIL);
      expect(first.pointsExpired).toBe(100);
      expect((await loyaltyService.getBalance(EMAIL)).points).toBe(0);

      // Earn fresh points and re-run expiry — the same old lot is already
      // consumed, so the new earn must survive untouched.
      await loyaltyRepository.applyTransaction(EMAIL, 'earn', 100, 'ord-new', 'Order purchase');
      const second = await loyaltyService.expireOldPoints(EMAIL);
      expect(second.pointsExpired).toBe(0);
      expect((await loyaltyService.getBalance(EMAIL)).points).toBe(100);
    });

    it('expiry only takes the unspent remainder of old lots', async () => {
      await loyaltyRepository.getOrCreateAccount(EMAIL);
      await loyaltyRepository.applyTransaction(EMAIL, 'earn', 100, 'ord-old', 'Order purchase');
      const { transactionId: redeemId } = await loyaltyService.redeemPoints(EMAIL, 'ord-redeem', 40);

      // Age the earn AND the redeem so both predate the threshold; the fresh
      // earn after expiry stays young.
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      await realDb.runAsync('UPDATE loyalty_transactions SET created_at = ? WHERE customer_email = ?', [twoDaysAgo, EMAIL]);
      // Fresh earn is young — its points are spent credit on old lots conceptually,
      // but chronologically the 60 old points should expire, nothing more.
      await loyaltyRepository.applyTransaction(EMAIL, 'earn', 50, 'ord-new', 'Order purchase');

      const result = await loyaltyService.expireOldPoints(EMAIL);
      // Old lot had 100, redemption consumed 40 → 60 remaining expired.
      expect(result.pointsExpired).toBe(60);
      // Balance was 110 (100−40+50) → 50 remains (the fresh lot).
      expect((await loyaltyService.getBalance(EMAIL)).points).toBe(50);
      void redeemId;
    });
  });

  describe('CUS-03 — earn idempotency per order', () => {
    it('replaying earnPoints for the same order awards points only once', async () => {
      // earnRate 100 cents/pt → a 100.00 order earns 100 points.
      await loyaltyService.earnPoints(EMAIL, 'order-1', 100);
      await loyaltyService.earnPoints(EMAIL, 'order-1', 100);

      expect((await loyaltyService.getBalance(EMAIL)).points).toBe(100);

      const rows = await realDb.getAllAsync<{ id: string }>(
        `SELECT id FROM loyalty_transactions WHERE customer_email = ? AND order_id = ? AND type = 'earn'`,
        [EMAIL, 'order-1']
      );
      expect(rows).toHaveLength(1);
    });

    it('different orders still earn independently, and non-earn entries do not collide', async () => {
      await loyaltyService.earnPoints(EMAIL, 'order-1', 100);
      await loyaltyService.earnPoints(EMAIL, 'order-2', 100);
      expect((await loyaltyService.getBalance(EMAIL)).points).toBe(200);

      // Manual adjustments referencing an order must not be deduplicated.
      await loyaltyRepository.applyTransaction(EMAIL, 'adjustment', 25, 'order-1', 'manual');
      await loyaltyRepository.applyTransaction(EMAIL, 'adjustment', 25, 'order-1', 'manual');
      expect((await loyaltyService.getBalance(EMAIL)).points).toBe(250);
    });
  });
});
