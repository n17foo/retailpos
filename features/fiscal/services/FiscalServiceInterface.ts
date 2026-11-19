/**
 * Fiscal service contract — docs/features/fiscal/README.md.
 *
 * One implementation per deployment mode (Offline SQLite / Instore API),
 * selected by `getFiscalService()` the same way `getOrderRepository()`
 * works for orders.
 */

export type FiscalJurisdiction = 'uk' | 'ie' | 'nl' | 'be' | 'es' | 'it' | 'de' | 'fr' | 'generic';

export type FiscalRecordType = 'sale' | 'return' | 'void' | 'z_report';

/** `unfinalized` = paid but no fiscal record yet (retryable). */
export type FiscalStatus = 'unfinalized' | 'fiscalized' | 'voided';

/** One immutable chained fiscal record (the legal artifact). */
export interface FiscalRecord {
  id: string;
  chainId: string;
  /** Per-chain sequential position. */
  seq: number;
  /** Display invoice number, e.g. `N17-A-000123`. */
  number: string;
  type: FiscalRecordType;
  orderId: string | null;
  returnId: string | null;
  shiftId: string | null;
  registerId: string | null;
  /** Canonical (sorted-key) JSON of the hashed content — spec §canonical payload. */
  payloadJson: string;
  prevHash: string;
  hash: string;
  createdAt: number;
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  /** First record whose hash/prev_hash doesn't verify, if any. */
  firstDivergenceSeq?: number;
  reason?: string;
}

/** Summary a caller hands `closeShift` — the service doesn't compute shifts. */
export interface ShiftFiscalSummary {
  shiftId: string;
  cashierId?: string;
  cashierName?: string;
  orderCount?: number;
  grossTotal?: number;
}

export interface FiscalService {
  /**
   * Allocate the next sequence number and chain a `sale` record for a paid
   * order. Atomic — the record insert, chain-head update and order
   * `fiscal_*` columns commit or roll back together.
   */
  finalizeSale(orderId: string): Promise<FiscalRecord>;
  /** Reverse a fiscalized order — a new `void` record, never a delete. */
  voidOrder(orderId: string, reason: string): Promise<FiscalRecord>;
  /** Chain a `return` record linked to the original sale. */
  registerReturn(returnId: string, orderId: string): Promise<FiscalRecord>;
  /** Chain a `z_report` record for a closed shift. */
  closeShift(summary: ShiftFiscalSummary): Promise<FiscalRecord>;
  getRecord(orderId: string): Promise<FiscalRecord | null>;
  /** Walk the chain and verify every hash — tamper detection. */
  verifyChain(fromSeq?: number): Promise<ChainVerification>;
}
