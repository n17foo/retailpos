import { fiscalRecordRepository, FiscalTransmissionRow } from '../repositories/FiscalRecordRepository';
import { posConfig } from '../../platform-clients/services/config/POSConfigService';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';
import { auditLogService } from '../../../shared/services/audit/AuditLogService';
import { getFiscalAuthorityCredentials } from './authorityCredentials';
import { FiscalAuthorityTransport, FiscalDeferralError } from './transports/FiscalAuthorityTransport';
import { AeatVerifactuTransport } from './transports/AeatVerifactuTransport';
import { FiskalyTseTransport } from './transports/FiskalyTseTransport';
import { offlineFiscalService } from './OfflineFiscalService';

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Authority-outbox drainer — same semantics as the order sync queue:
 * pending rows are submitted, failures retry until the attempt cap,
 * then go 'dead' for manual review.
 *
 * Only runs in standalone mode — in client mode the Store API drains
 * its own outbox (it holds the merchant credentials server-side).
 */
export class FiscalTransmissionDrainer {
  private logger = LoggerFactory.getInstance().createLogger('FiscalTransmissionDrainer');
  private transports: Record<string, FiscalAuthorityTransport> = {
    aeat: new AeatVerifactuTransport(),
    tse: new FiskalyTseTransport(),
  };
  private timer: ReturnType<typeof setInterval> | null = null;
  private draining = false;

  start(intervalMs = DEFAULT_INTERVAL_MS): void {
    this.stop();
    this.timer = setInterval(() => {
      this.drainOnce().catch(err => {
        this.logger.warn({ message: 'Fiscal transmission drain failed' }, err instanceof Error ? err : new Error(String(err)));
      });
    }, intervalMs);
    // Kick one immediately — don't wait a full interval for a backlog.
    this.drainOnce().catch(() => {});
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async drainOnce(): Promise<void> {
    // Client mode: the Store API drains — it owns the chain + credentials.
    if (this.draining || instoreApiConfig.isClient || !posConfig.values.fiscalEnabled) {
      return;
    }
    this.draining = true;
    try {
      const maxAttempts = posConfig.values.maxSyncRetries ?? 5;

      // F04 recovery — retry finalization for orders left paid but
      // unfiscalized (failed strict-mode checkouts, crashes after payment).
      await offlineFiscalService.reconcileUnfinalizedOrders().catch(err => {
        this.logger.warn({ message: 'Unfinalized-order reconciliation failed' }, err instanceof Error ? err : new Error(String(err)));
      });

      const rows = await fiscalRecordRepository.listPendingTransmissions(maxAttempts);
      for (const row of rows) {
        await this.submitRow(row, maxAttempts).catch(err => {
          this.logger.warn(
            { message: `Transmission ${row.id} (${row.authority}) submission error` },
            err instanceof Error ? err : new Error(String(err))
          );
        });
      }
    } finally {
      this.draining = false;
    }
  }

  private async submitRow(row: FiscalTransmissionRow, maxAttempts: number): Promise<void> {
    const transport = this.transports[row.authority];
    if (!transport) {
      await fiscalRecordRepository.markTransmissionFailed(row.id, `no transport for authority '${row.authority}'`, maxAttempts);
      return;
    }
    try {
      const credentials = await getFiscalAuthorityCredentials(row.authority);
      const response = await transport.submit(row, credentials);
      await fiscalRecordRepository.markTransmissionSent(row.id, response);
      auditLogService.log('fiscal:transmitted', {
        details: `Fiscal record ${row.record_id} submitted to ${row.authority}`,
        metadata: { transmissionId: row.id, recordId: row.record_id, authority: row.authority },
      });
    } catch (err) {
      if (err instanceof FiscalDeferralError) {
        // Missing credentials/endpoint — leave pending without burning an attempt.
        return;
      }
      await fiscalRecordRepository.markTransmissionFailed(row.id, err instanceof Error ? err.message : String(err), maxAttempts);
      this.logger.warn(
        { message: `Transmission ${row.id} failed (${row.authority})` },
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }
}

export const fiscalTransmissionDrainer = new FiscalTransmissionDrainer();
