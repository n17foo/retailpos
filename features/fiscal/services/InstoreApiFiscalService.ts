import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { posConfig } from '../../platform-clients/services/config/POSConfigService';
import { getFiscalAuthorityAdapter } from './authorities/getFiscalAuthorityAdapter';
import type { FiscalJurisdiction } from './FiscalServiceInterface';
import type { ChainVerification, FiscalRecord, FiscalService, ShiftFiscalSummary } from './FiscalServiceInterface';

/**
 * Multi-register fiscal service — every call delegates to the Store API,
 * the single chain authority in `client` mode (docs/features/fiscal R1).
 * Registers never keep local counters: concurrent tills get their
 * numbers from the server's atomic allocation.
 *
 * Authority submission (AEAT, TSE) is server-owned; the register's
 * adapter is resolved only to (a) fail fast on unsupported jurisdictions
 * before the server commit and (b) produce receipt artifacts like the ES
 * record-mode ValidarQR URL.
 */
export class InstoreApiFiscalService implements FiscalService {
  private get jurisdiction(): FiscalJurisdiction {
    return posConfig.values.fiscalJurisdiction ?? 'generic';
  }

  async finalizeSale(orderId: string): Promise<FiscalRecord> {
    const adapter = getFiscalAuthorityAdapter(this.jurisdiction);
    const record = await instoreApiClient.fiscalFinalize(orderId);
    return this.attachReceiptOutcome(record, adapter);
  }

  async voidOrder(orderId: string, reason: string): Promise<FiscalRecord> {
    const adapter = getFiscalAuthorityAdapter(this.jurisdiction);
    const record = await instoreApiClient.fiscalVoid(orderId, reason);
    return this.attachReceiptOutcome(record, adapter);
  }

  async registerReturn(returnId: string, orderId: string): Promise<FiscalRecord> {
    const adapter = getFiscalAuthorityAdapter(this.jurisdiction);
    const record = await instoreApiClient.fiscalReturn(returnId, orderId);
    return this.attachReceiptOutcome(record, adapter);
  }

  closeShift(summary: ShiftFiscalSummary): Promise<FiscalRecord> {
    return instoreApiClient.fiscalCloseShift(summary);
  }

  getRecord(orderId: string): Promise<FiscalRecord | null> {
    return instoreApiClient.getFiscalRecord(orderId);
  }

  verifyChain(fromSeq?: number): Promise<ChainVerification> {
    return instoreApiClient.verifyFiscalChain(fromSeq);
  }

  private attachReceiptOutcome(record: FiscalRecord, adapter: ReturnType<typeof getFiscalAuthorityAdapter>): FiscalRecord {
    const outcome = adapter.receiptOutcome?.(record);
    if (outcome?.receiptQrUrl) {
      record.authorityQr = outcome.receiptQrUrl;
    }
    return record;
  }
}
