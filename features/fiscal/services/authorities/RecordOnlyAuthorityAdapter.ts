import type { FiscalAuthorityAdapter } from './FiscalAuthorityAdapter';
import type { FiscalJurisdiction, FiscalRecord } from '../FiscalServiceInterface';

/**
 * Record-only markets — UK, IE, NL, BE(retail). No per-sale transmission
 * or signing exists; the chain + sequential number satisfy the legal
 * minimum (general VAT record-keeping). Kept as a distinct adapter so
 * jurisdiction-specific receipt wording can hang off it later.
 */
export class RecordOnlyAuthorityAdapter implements FiscalAuthorityAdapter {
  constructor(readonly jurisdiction: FiscalJurisdiction) {}
  async onRecord(_record: FiscalRecord): Promise<undefined> {
    return undefined;
  }
}
