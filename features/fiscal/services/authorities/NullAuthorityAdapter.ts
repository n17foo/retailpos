import type { FiscalAuthorityAdapter } from './FiscalAuthorityAdapter';
import type { FiscalJurisdiction, FiscalRecord } from '../FiscalServiceInterface';

/**
 * 'generic' jurisdiction — performs NO authority actions. The chain and
 * sequential numbering still run; nothing is transmitted, signed, or
 * annotated (docs/features/fiscal rules R10).
 */
export class NullAuthorityAdapter implements FiscalAuthorityAdapter {
  readonly jurisdiction: FiscalJurisdiction = 'generic';
  async onRecord(_record: FiscalRecord): Promise<undefined> {
    return undefined;
  }
}
