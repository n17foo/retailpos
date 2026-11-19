import type { FiscalJurisdiction, FiscalRecord } from '../FiscalServiceInterface';

/**
 * Per-jurisdiction authority work that runs AFTER the chain record is
 * committed — transmission (AEAT/myDATA-style), signing requests (TSE),
 * or nothing at all for record-only markets. The chain itself never
 * depends on the authority: a failed adapter call goes to the
 * `fiscal_transmissions` outbox, never back into the ledger.
 *
 * docs/features/fiscal/README.md §Jurisdiction matrix.
 */
/** Artifacts an adapter can hand back to the caller (receipt extras). */
export interface FiscalAuthorityOutcome {
  /** Receipt QR payload — e.g. the Veri*factu ValidarQR URL. */
  receiptQrUrl?: string;
}

export interface FiscalAuthorityAdapter {
  readonly jurisdiction: FiscalJurisdiction;
  /** Post-commit authority work for a new fiscal record. */
  onRecord(record: FiscalRecord): Promise<FiscalAuthorityOutcome | undefined>;
  /**
   * Side-effect-free receipt artifacts for an existing record — safe to
   * call in client mode where authority submission is server-owned.
   */
  receiptOutcome?(record: FiscalRecord): FiscalAuthorityOutcome | undefined;
}

export class UnsupportedAuthorityError extends Error {
  constructor(jurisdiction: string) {
    super(`Fiscal jurisdiction '${jurisdiction}' is not implemented yet — see docs/features/fiscal (certified-tier adapter)`);
    this.name = 'UnsupportedAuthorityError';
  }
}
