import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import type { ChainVerification, FiscalRecord, FiscalService, ShiftFiscalSummary } from './FiscalServiceInterface';

/**
 * Multi-register fiscal service — every call delegates to the Store API,
 * the single chain authority in `client` mode (docs/features/fiscal R1).
 * Registers never keep local counters: concurrent tills get their
 * numbers from the server's atomic allocation.
 */
export class InstoreApiFiscalService implements FiscalService {
  finalizeSale(orderId: string): Promise<FiscalRecord> {
    return instoreApiClient.fiscalFinalize(orderId);
  }

  voidOrder(orderId: string, reason: string): Promise<FiscalRecord> {
    return instoreApiClient.fiscalVoid(orderId, reason);
  }

  registerReturn(returnId: string, orderId: string): Promise<FiscalRecord> {
    return instoreApiClient.fiscalReturn(returnId, orderId);
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
}
