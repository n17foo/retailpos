import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import type { StoreCreditEntryRow, StoreCreditEntryType } from './StoreCreditRepository';

/** Contract shared by the local and Store API credit ledgers. */
export interface StoreCreditLedger {
  getBalanceCents(email: string): Promise<number>;
  appendEntry(
    email: string,
    type: StoreCreditEntryType,
    amountCents: number,
    orderId?: string | null,
    reason?: string | null,
    createdBy?: string | null,
    reversesId?: string | null
  ): Promise<string>;
  /**
   * Balance check + debit as one serialized operation — the clamped
   * redemption is only written while sufficient balance remains (CUS-02).
   */
  redeemIfSufficient(email: string, requestedCents: number, orderId?: string | null): Promise<{ entryId: string; redeemedCents: number }>;
  findEntriesByEmail(email: string, limit?: number): Promise<StoreCreditEntryRow[]>;
  findEntryById(id: string): Promise<StoreCreditEntryRow | null>;
}

/**
 * Store API-backed store-credit ledger. Debits that would take the running
 * balance below zero are rejected server-side (HTTP 409) — two registers
 * cannot redeem the same credit.
 */
export class InstoreApiStoreCreditRepository implements StoreCreditLedger {
  async getBalanceCents(email: string): Promise<number> {
    const result = await instoreApiClient.getStoreCredit(email);
    return result.balance_cents;
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
    const entry = (await instoreApiClient.appendStoreCreditEntry({
      customer_email: email,
      type,
      amount_cents: amountCents,
      order_id: orderId ?? null,
      reason: reason ?? null,
      created_by: createdBy ?? null,
      reverses_id: reversesId ?? null,
    })) as StoreCreditEntryRow;
    return entry.id;
  }

  async redeemIfSufficient(
    email: string,
    requestedCents: number,
    orderId?: string | null
  ): Promise<{ entryId: string; redeemedCents: number }> {
    // The server conditions the debit on the current balance (HTTP 409 on
    // overdraw); the clamp keeps the request at or below the known balance.
    const balance = await this.getBalanceCents(email);
    const redeemedCents = Math.min(requestedCents, balance);
    if (redeemedCents <= 0) throw new Error('Insufficient store credit balance');
    const entryId = await this.appendEntry(email, 'redeem', -redeemedCents, orderId ?? null, 'Store credit redemption');
    return { entryId, redeemedCents };
  }

  async findEntriesByEmail(email: string, limit = 50): Promise<StoreCreditEntryRow[]> {
    const result = await instoreApiClient.getStoreCredit(email, limit);
    return result.entries as StoreCreditEntryRow[];
  }

  async findEntryById(id: string): Promise<StoreCreditEntryRow | null> {
    const entry = await instoreApiClient.getStoreCreditEntry(id);
    return (entry as StoreCreditEntryRow | null) ?? null;
  }
}

export const instoreApiStoreCreditRepository = new InstoreApiStoreCreditRepository();
