import { RecordOnlyAuthorityAdapter } from './RecordOnlyAuthorityAdapter';
import type { FiscalJurisdiction } from '../FiscalServiceInterface';

/**
 * France — NF525/ISCA. Record-only mechanically: no per-sale
 * transmission exists. The legal conditions (inaltérabilité,
 * sécurisation, conservation, archivage) map onto the append-only chain
 * + shift-closure z_reports; period archives are generated at period
 * close, which is export-layer scope, not adapter scope.
 *
 * NOTE: the certificate requirement (LNE/Infocert audit — mandatory
 * since the Feb 2025 Finance Act) is a release-process gate, not code.
 */
export class FrNf525Adapter extends RecordOnlyAuthorityAdapter {
  constructor() {
    super('fr' as FiscalJurisdiction);
  }
}
