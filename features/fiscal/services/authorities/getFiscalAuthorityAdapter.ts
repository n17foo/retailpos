import { FiscalAuthorityAdapter, UnsupportedAuthorityError } from './FiscalAuthorityAdapter';
import { NullAuthorityAdapter } from './NullAuthorityAdapter';
import { RecordOnlyAuthorityAdapter } from './RecordOnlyAuthorityAdapter';
import type { FiscalJurisdiction } from '../FiscalServiceInterface';

/**
 * Select the authority adapter for the configured jurisdiction.
 * Record-only markets share one adapter; the certified tier (ES/IT/DE/FR)
 * throws until its vendor adapters land — fail-closed on purpose: a
 * merchant must not sell under an unimplemented fiscal regime.
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
    case 'it':
    case 'de':
    case 'fr':
      throw new UnsupportedAuthorityError(jurisdiction);
  }
}
