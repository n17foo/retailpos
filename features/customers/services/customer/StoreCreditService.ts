/**
 * StoreCreditService
 *
 * Issue, redeem, expire, and query store credit.
 * All amounts in integer cents (per ADR-006).
 * Local-first — the SQLite ledger is always authoritative.
 *
 * Configuration key: storeCredit.enabled (boolean, default false)
 *
 * See: docs/specs/customer/crm-loyalty.md §2.6–2.8
 */

import { storeCreditRepository } from '../../repositories/StoreCreditRepository';
import { keyValueRepository } from '../../../../shared/repositories/KeyValueRepository';
import { auditLogService } from '../../../../shared/services/audit/AuditLogService';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { toDollars } from '../../../../shared/utils/money';

const CONFIG_KEY = 'storeCredit.enabled';

export class StoreCreditService {
  private static instance: StoreCreditService;
  private logger = LoggerFactory.getInstance().createLogger('StoreCreditService');

  private constructor() {}

  static getInstance(): StoreCreditService {
    if (!StoreCreditService.instance) {
      StoreCreditService.instance = new StoreCreditService();
    }
    return StoreCreditService.instance;
  }

  async isEnabled(): Promise<boolean> {
    const val = await keyValueRepository.getObject<boolean>(CONFIG_KEY);
    return val ?? false;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await keyValueRepository.setObject(CONFIG_KEY, enabled);
  }

  // ── Balance ───────────────────────────────────────────────────────────

  async getBalanceCents(email: string): Promise<number> {
    return storeCreditRepository.getBalanceCents(email);
  }

  async getBalanceDollars(email: string): Promise<number> {
    return toDollars(await this.getBalanceCents(email));
  }

  // ── Issue ─────────────────────────────────────────────────────────────

  async issue(email: string, amountCents: number, reason: string, issuedBy?: string): Promise<string> {
    if (amountCents <= 0) throw new Error('Issue amount must be positive');

    const entryId = await storeCreditRepository.appendEntry(email, 'issue', amountCents, null, reason, issuedBy);

    await auditLogService.log('store_credit:issued', {
      userId: issuedBy,
      details: `Store credit issued to ${email}: ${toDollars(amountCents).toFixed(2)} — ${reason}`,
      metadata: { email, amountCents, reason, entryId },
    });

    this.logger.info(`Issued ${amountCents}¢ store credit to ${email}`);
    return entryId;
  }

  // ── Redeem ────────────────────────────────────────────────────────────

  /**
   * Redeem store credit. Clamps to available balance.
   * Returns the actual amount redeemed in cents.
   */
  async redeem(
    email: string,
    orderId: string,
    requestedCents: number
  ): Promise<{ entryId: string; redeemedCents: number; discountDollars: number }> {
    const balance = await this.getBalanceCents(email);
    const redeemedCents = Math.min(requestedCents, balance);

    if (redeemedCents <= 0) throw new Error('Insufficient store credit balance');

    const entryId = await storeCreditRepository.appendEntry(email, 'redeem', -redeemedCents, orderId, 'Store credit redemption');

    await auditLogService.log('store_credit:redeemed', {
      details: `Store credit redeemed by ${email}: ${toDollars(redeemedCents).toFixed(2)} on order ${orderId}`,
      metadata: { email, redeemedCents, orderId, entryId },
    });

    return { entryId, redeemedCents, discountDollars: toDollars(redeemedCents) };
  }

  /**
   * Reverse a redemption (e.g. basket cleared after redeeming).
   */
  async reverseRedemption(entryId: string): Promise<void> {
    try {
      const entry = await storeCreditRepository.findEntryById(entryId);
      if (!entry || entry.type !== 'redeem') return;

      const restoredCents = Math.abs(entry.amount_cents);
      await storeCreditRepository.appendEntry(entry.customer_email, 'reversal', restoredCents, entry.order_id, `Reversal of ${entryId}`);
      this.logger.info(`Reversed store credit redemption ${entryId} — restored ${restoredCents}¢`);
    } catch (err) {
      this.logger.error(
        { message: `Failed to reverse store credit redemption ${entryId}` },
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  // ── Expire ────────────────────────────────────────────────────────────

  async expireCredit(email: string, amountCents: number, reason: string, expiredBy?: string): Promise<void> {
    const balance = await this.getBalanceCents(email);
    const toExpire = Math.min(amountCents, balance);
    if (toExpire <= 0) return;

    await storeCreditRepository.appendEntry(email, 'expire', -toExpire, null, reason, expiredBy);

    await auditLogService.log('store_credit:expired', {
      userId: expiredBy,
      details: `Store credit expired for ${email}: ${toDollars(toExpire).toFixed(2)} — ${reason}`,
      metadata: { email, amountCents: toExpire, reason },
    });
  }

  // ── History ───────────────────────────────────────────────────────────

  async getHistory(email: string, limit = 50) {
    return storeCreditRepository.findEntriesByEmail(email, limit);
  }
}

export const storeCreditService = StoreCreditService.getInstance();
