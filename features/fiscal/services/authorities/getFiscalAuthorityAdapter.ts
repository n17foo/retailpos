import { FiscalAuthorityAdapter, UnsupportedAuthorityError } from './FiscalAuthorityAdapter';
import { NullAuthorityAdapter } from './NullAuthorityAdapter';
import { RecordOnlyAuthorityAdapter } from './RecordOnlyAuthorityAdapter';
import { EsVerifactuAdapter } from './EsVerifactuAdapter';
import { DeTseAdapter } from './DeTseAdapter';
import { FrNf525Adapter } from './FrNf525Adapter';
import type { FiscalJurisdiction } from '../FiscalServiceInterface';

/**
 * Select the authority adapter for the configured jurisdiction.
 * Record-only markets share one adapter; Italy alone stays unsupported —
 * it needs an AdE-approved software solution or RT-device partner, so
 * configuring 'it' fails closed rather than produce illegal receipts.
 */
export function getFiscalAuthorityAdapter(jurisdiction: FiscalJurisdiction): FiscalAuthorityAdapter {
  switch (jurisdiction) {
    case 'generic':
      return new NullAuthorityAdapter();
    case 'uk':
    case 'ie':
    case 'nl':
    case 'be':
      return new RecordOnlyAuthorityAdapter(jurisdiction);
    case 'es':
      return new EsVerifactuAdapter();
    case 'de':
      return new DeTseAdapter();
    case 'fr':
      return new FrNf525Adapter();
    case 'it':
      throw new UnsupportedAuthorityError(jurisdiction);
  }
}
