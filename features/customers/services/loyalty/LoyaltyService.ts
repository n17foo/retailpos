/**
 * LoyaltyService
 *
 * Earn, redeem, adjust, and query loyalty points.
 * Local-first — the SQLite ledger is always authoritative.
 * Platform outbound sync is non-blocking and only runs when
 * the loyalty capability is 'custom' and the adapter is ready.
 *
 * Configuration keys (stored in key_value_store):
 *   loyalty.enabled      boolean  (default false)
 *   loyalty.earnRate     number   cents per 1 point (default 100 = £1 per point)
 *   loyalty.redeemRate   number   cents per point when redeeming (default 1 = 1p per point)
 *   loyalty.expiryDays   number | null
 *
 * See: docs/specs/customer/crm-loyalty.md §2.3–2.5
 */

import { getLoyaltyRepository } from '../../repositories/LoyaltyRepository';
import { instoreApiConfig } from '../../../multi-register/services/InstoreApiConfig';
import { instoreApiClient } from '../../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { keyValueRepository } from '../../../../shared/repositories/KeyValueRepository';
import { auditLogService } from '../../../../shared/services/audit/AuditLogService';
import { notificationService } from '../../../../shared/services/notifications/NotificationService';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { toCents, toDollars } from '../../../../shared/utils/money';

export interface LoyaltyConfig {
  enabled: boolean;
  earnRate: number; // cents per 1 point earned
  redeemRate: number; // cents per point when redeeming
  expiryDays: number | null;
}

const DEFAULT_CONFIG: LoyaltyConfig = {
  enabled: false,
  earnRate: 100,
  redeemRate: 1,
  expiryDays: null,
};

const CONFIG_KEY = 'loyalty.config';

export interface LoyaltyBalance {
  points: number;
  valueInCents: number;
  tier: string | null;
  lifetimeEarned: number;
}

export class LoyaltyService {
  private static instance: LoyaltyService;
  private logger = LoggerFactory.getInstance().createLogger('LoyaltyService');
  private configCache: LoyaltyConfig | null = null;

  private constructor() {}

  static getInstance(): LoyaltyService {
    if (!LoyaltyService.instance) {
      LoyaltyService.instance = new LoyaltyService();
    }
    return LoyaltyService.instance;
  }

  // ── Config ────────────────────────────────────────────────────────────

  async getConfig(): Promise<LoyaltyConfig> {
    if (this.configCache) return this.configCache;
    const stored = await keyValueRepository.getObject<LoyaltyConfig>(CONFIG_KEY);
    this.configCache = stored ?? DEFAULT_CONFIG;
    return this.configCache;
  }

  async updateConfig(config: Partial<LoyaltyConfig>): Promise<void> {
    const current = await this.getConfig();
    const updated = { ...current, ...config };
    await keyValueRepository.setObject(CONFIG_KEY, updated);
    this.configCache = updated;
  }

  // ── Balance ───────────────────────────────────────────────────────────

  async getBalance(email: string): Promise<LoyaltyBalance> {
    const account = await getLoyaltyRepository().getOrCreateAccount(email);
    const config = await this.getConfig();

    // Calculate tier based on lifetime earned
    const tier = this.calculateTier(account.lifetime_earned);

    return {
      points: account.balance,
      valueInCents: account.balance * config.redeemRate,
      tier,
      lifetimeEarned: account.lifetime_earned,
    };
  }

  /**
   * Calculate loyalty tier based on lifetime points earned.
   * Tiers: Bronze (default), Silver (500+), Gold (2000+)
   */
  private calculateTier(lifetimeEarned: number): string {
    // Tier thresholds (can be made configurable later)
    const TIER_SILVER = 500;
    const TIER_GOLD = 2000;

    if (lifetimeEarned >= TIER_GOLD) return 'Gold';
    if (lifetimeEarned >= TIER_SILVER) return 'Silver';
    return 'Bronze';
  }

  /**
   * Update the tier in the loyalty_accounts table.
   * Called after earn/adjust operations.
   */
  private async updateTier(email: string): Promise<void> {
    try {
      const account = await getLoyaltyRepository().getOrCreateAccount(email);
      const newTier = this.calculateTier(account.lifetime_earned);

      if (account.tier !== newTier) {
        await getLoyaltyRepository().updateTier(email, newTier);
        this.logger.info(`Updated tier for ${email}: ${account.tier} → ${newTier}`);
      }
    } catch (err) {
      this.logger.error({ message: `Failed to update tier for ${email}` }, err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ── Earn ──────────────────────────────────────────────────────────────

  /**
   * Earn points for a completed order.
   * Non-blocking — failure must not block checkout.
   */
  async earnPoints(email: string, orderId: string, orderTotal: number): Promise<void> {
    try {
      const config = await this.getConfig();
      if (!config.enabled) return;

      const totalCents = toCents(orderTotal);
      const pointsEarned = Math.floor(totalCents / config.earnRate);
      if (pointsEarned <= 0) return;

      await getLoyaltyRepository().getOrCreateAccount(email);
      await getLoyaltyRepository().applyTransaction(email, 'earn', pointsEarned, orderId, 'Order purchase');

      // Update tier after earning points
      await this.updateTier(email);

      notificationService.notify('Loyalty Points Earned', `+${pointsEarned} points earned on this order`, 'info');

      this.logger.info(`Earned ${pointsEarned} points for ${email} on order ${orderId}`);
    } catch (err) {
      this.logger.error({ message: `Failed to earn points for ${email}` }, err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ── Redeem ────────────────────────────────────────────────────────────

  /**
   * Redeem points. Returns the discount amount in dollars.
   * Throws if insufficient balance.
   */
  async redeemPoints(email: string, orderId: string, pointsToRedeem: number): Promise<{ transactionId: string; discountDollars: number }> {
    const config = await this.getConfig();
    const account = await getLoyaltyRepository().getOrCreateAccount(email);

    const clamped = Math.min(pointsToRedeem, account.balance);
    if (clamped <= 0) throw new Error('Insufficient loyalty points balance');

    let txId: string;
    try {
      txId = await getLoyaltyRepository().applyTransaction(email, 'redeem', -clamped, orderId, 'Points redemption');
    } catch (err) {
      // A parallel register may have spent the points between read and write.
      throw new Error('Insufficient loyalty points balance', { cause: err });
    }

    const discountCents = clamped * config.redeemRate;
    const discountDollars = toDollars(discountCents);

    this.logger.info(`Redeemed ${clamped} points for ${email} — discount ${discountDollars}`);
    return { transactionId: txId, discountDollars };
  }

  /**
   * Reverse a redemption (e.g. basket cleared after redeeming).
   */
  async reverseRedemption(transactionId: string): Promise<void> {
    try {
      const tx = await getLoyaltyRepository().findTransactionById(transactionId);
      if (!tx || tx.type !== 'redeem') return;

      const restoredPoints = Math.abs(tx.points);
      await getLoyaltyRepository().applyTransaction(
        tx.customer_email,
        'reversal',
        restoredPoints,
        tx.order_id,
        `Reversal of ${transactionId}`
      );
      this.logger.info(`Reversed redemption ${transactionId} — restored ${restoredPoints} points`);
    } catch (err) {
      this.logger.error({ message: `Failed to reverse redemption ${transactionId}` }, err instanceof Error ? err : new Error(String(err)));
      notificationService.notify('Loyalty Warning', `Failed to reverse points redemption — manual review required`, 'warning');
    }
  }

  // ── Manual Adjustment ─────────────────────────────────────────────────

  async adjustPoints(email: string, delta: number, reason: string, managerId?: string): Promise<void> {
    await getLoyaltyRepository().getOrCreateAccount(email);
    await getLoyaltyRepository().applyTransaction(email, 'adjustment', delta, null, reason, managerId);

    // Update tier after adjustment
    await this.updateTier(email);

    await auditLogService.log('loyalty:adjusted', {
      userId: managerId,
      details: `Loyalty adjustment for ${email}: ${delta > 0 ? '+' : ''}${delta} points — ${reason}`,
      metadata: { email, delta, reason },
    });
  }

  // ── Transaction history ───────────────────────────────────────────────

  async getTransactions(email: string, limit = 50) {
    return getLoyaltyRepository().findTransactionsByEmail(email, limit);
  }

  // ── Points Expiry ─────────────────────────────────────────────────────

  /**
   * Expire points for transactions older than the configured expiry period.
   * This should be called by a background job (e.g. daily cron).
   *
   * @param email Optional email to expire points for a specific customer
   * @returns Number of customers processed and total points expired
   */
  async expireOldPoints(email?: string): Promise<{ customersProcessed: number; pointsExpired: number }> {
    const config = await this.getConfig();

    // If expiry is disabled, return immediately
    if (!config.expiryDays || config.expiryDays <= 0) {
      return { customersProcessed: 0, pointsExpired: 0 };
    }

    const expiryThreshold = Date.now() - config.expiryDays * 24 * 60 * 60 * 1000;
    let customersProcessed = 0;
    let totalPointsExpired = 0;

    // Multi-register: expiry runs once on the Store API — the first register
    // to trigger it performs the pass, repeat calls find nothing to expire.
    if (instoreApiConfig.isClient && !email) {
      const result = await instoreApiClient.expireLoyaltyPoints(expiryThreshold, `Points expired after ${config.expiryDays} days`);
      return { customersProcessed: result.customers_processed, pointsExpired: result.points_expired };
    }

    try {
      // Get all customers with transactions older than expiry threshold
      const customers = email ? [email] : await getLoyaltyRepository().findCustomersWithExpiredTransactions(expiryThreshold);

      for (const customerEmail of customers) {
        try {
          // Get expired transactions for this customer
          const expiredTransactions = await getLoyaltyRepository().findExpiredEarnTransactions(customerEmail, expiryThreshold);

          if (expiredTransactions.length === 0) continue;

          // Calculate total points to expire
          const pointsToExpire = expiredTransactions.reduce((sum, tx) => sum + tx.points, 0);

          if (pointsToExpire <= 0) continue;

          // Get current balance to ensure we don't expire more than available
          const account = await getLoyaltyRepository().getOrCreateAccount(customerEmail);
          const actualPointsToExpire = Math.min(pointsToExpire, account.balance);

          if (actualPointsToExpire <= 0) continue;

          // Create expiry transaction
          await getLoyaltyRepository().applyTransaction(
            customerEmail,
            'expire',
            -actualPointsToExpire,
            null,
            `Points expired after ${config.expiryDays} days`,
            'system'
          );

          // Log the expiry
          await auditLogService.log('loyalty:expired', {
            userId: 'system',
            details: `Expired ${actualPointsToExpire} points for ${customerEmail} (${expiredTransactions.length} transactions older than ${config.expiryDays} days)`,
            metadata: {
              email: customerEmail,
              pointsExpired: actualPointsToExpire,
              transactionCount: expiredTransactions.length,
              expiryDays: config.expiryDays,
            },
          });

          customersProcessed++;
          totalPointsExpired += actualPointsToExpire;

          this.logger.info(`Expired ${actualPointsToExpire} points for ${customerEmail} (${expiredTransactions.length} transactions)`);
        } catch (err) {
          this.logger.error(
            { message: `Failed to expire points for ${customerEmail}` },
            err instanceof Error ? err : new Error(String(err))
          );
          // Continue processing other customers
        }
      }

      if (customersProcessed > 0) {
        this.logger.info(`Points expiry completed: ${customersProcessed} customers processed, ${totalPointsExpired} points expired`);
      }

      return { customersProcessed, pointsExpired: totalPointsExpired };
    } catch (err) {
      this.logger.error({ message: 'Failed to run points expiry job' }, err instanceof Error ? err : new Error(String(err)));
      return { customersProcessed, pointsExpired: totalPointsExpired };
    }
  }

  /**
   * Check if a customer has points that will expire soon.
   * Useful for sending expiry warnings.
   *
   * @param email Customer email
   * @param warningDays Number of days before expiry to warn (default 7)
   * @returns Points expiring soon and expiry date
   */
  async getExpiringPoints(email: string, warningDays = 7): Promise<{ pointsExpiring: number; expiryDate: Date | null }> {
    const config = await this.getConfig();

    if (!config.expiryDays || config.expiryDays <= 0) {
      return { pointsExpiring: 0, expiryDate: null };
    }

    const expiryThreshold = Date.now() - config.expiryDays * 24 * 60 * 60 * 1000;
    const warningThreshold = Date.now() - (config.expiryDays - warningDays) * 24 * 60 * 60 * 1000;

    try {
      const expiringTransactions = await getLoyaltyRepository().findEarnTransactionsBetween(email, expiryThreshold, warningThreshold);

      if (expiringTransactions.length === 0) {
        return { pointsExpiring: 0, expiryDate: null };
      }

      const pointsExpiring = expiringTransactions.reduce((sum, tx) => sum + tx.points, 0);

      // Find the earliest expiry date
      const earliestTransaction = expiringTransactions.reduce((earliest, tx) => (tx.created_at < earliest.created_at ? tx : earliest));

      const expiryDate = new Date(earliestTransaction.created_at + config.expiryDays * 24 * 60 * 60 * 1000);

      return { pointsExpiring, expiryDate };
    } catch (err) {
      this.logger.error({ message: `Failed to get expiring points for ${email}` }, err instanceof Error ? err : new Error(String(err)));
      return { pointsExpiring: 0, expiryDate: null };
    }
  }
}

export const loyaltyService = LoyaltyService.getInstance();
