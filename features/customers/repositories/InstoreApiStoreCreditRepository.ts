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
    createdBy?: string | null
  ): Promise<string>;
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
    createdBy?: string | null
  ): Promise<string> {
    const entry = (await instoreApiClient.appendStoreCreditEntry({
      customer_email: email,
      type,
      amount_cents: amountCents,
      order_id: orderId ?? null,
      reason: reason ?? null,
      created_by: createdBy ?? null,
    })) as StoreCreditEntryRow;
    return entry.id;
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
