import { fiscalRecordRepository } from '../../repositories/FiscalRecordRepository';
import { generateUUID } from '../../../../shared/utils/uuid';
import type { FiscalAuthorityAdapter } from './FiscalAuthorityAdapter';
import type { FiscalJurisdiction, FiscalRecord } from '../FiscalServiceInterface';

/**
 * Germany — KassenSichV/TSE. Every sale record must carry a signature
 * from a certified Technische Sicherheitseinrichtung. Signing is an
 * outbox operation ('tse' authority): the drainer calls the configured
 * TSE vendor (fiskaly SIGN DE) and stores the returned signature +
 * transaction number + serial in the transmission's `response` — the
 * receipt QR derives from it.
 */
export class DeTseAdapter implements FiscalAuthorityAdapter {
  readonly jurisdiction: FiscalJurisdiction = 'de';
  private repo = fiscalRecordRepository;

  async onRecord(record: FiscalRecord): Promise<undefined> {
    await this.repo.enqueueTransmission(generateUUID(), record.id, 'tse', record.payloadJson);
    return undefined;
  }
}
