import { db } from '../../../shared/utils/db';
import { sha256Hex } from '../../../shared/utils/crypto';
import { generateUUID } from '../../../shared/utils/uuid';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';
import { posConfig } from '../../platform-clients/services/config/POSConfigService';
import { orderRepository } from '../../orders-sync/repositories/OrderRepository';
import { fiscalRecordRepository, FiscalRecordRow } from '../repositories/FiscalRecordRepository';
import { canonicalize } from './FiscalCanonicalizer';
import { getFiscalAuthorityAdapter } from './authorities/getFiscalAuthorityAdapter';
import type {
  ChainVerification,
  FiscalJurisdiction,
  FiscalRecord,
  FiscalRecordType,
  FiscalService,
  ShiftFiscalSummary,
} from './FiscalServiceInterface';

const GENESIS_HASH = 'GENESIS';
/** Standalone deployments have exactly one chain. */
const LOCAL_CHAIN_ID = 'local';

/**
 * Standalone/offline fiscal authority — chain + numbering live in the
 * register's own SQLite (`fiscal_records`, `fiscal_chain_state`).
 * Multi-register registers never instantiate this; the Store API
 * allocates instead (docs/features/fiscal/README.md R1).
 */
export class OfflineFiscalService implements FiscalService {
  private logger = LoggerFactory.getInstance().createLogger('OfflineFiscalService');
  private repo = fiscalRecordRepository;

  private get jurisdiction(): FiscalJurisdiction {
    return posConfig.values.fiscalJurisdiction ?? 'generic';
  }

  private invoiceNumber(seq: number): string {
    const prefix = posConfig.values.fiscalInvoicePrefix ?? 'POS';
    const series = posConfig.values.fiscalSeries ?? 'A';
    return `${prefix}-${series}-${String(seq).padStart(6, '0')}`;
  }

  async finalizeSale(orderId: string): Promise<FiscalRecord> {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Cannot fiscalize unknown order ${orderId}`);
    }
    if (order.fiscal_status === 'fiscalized') {
      // Idempotent — recovery re-running finalize returns the existing record.
      const existing = await this.repo.findByOrderId(orderId);
      if (existing) {
        return this.mapRow(existing);
      }
    }
    if (order.status !== 'paid' && order.status !== 'synced') {
      throw new Error(`Cannot fiscalize order ${orderId} in status '${order.status}' — payment must be recorded first`);
    }

    const record = await this.allocateRecord('sale', {
      orderId,
      order: {
        total: order.total,
        tax: order.tax,
        subtotal: order.subtotal,
        paymentMethod: order.payment_method,
      },
      registerId: order.register_id ?? null,
    });
    await this.notifyAuthority(record);
    return record;
  }

  async voidOrder(orderId: string, reason: string): Promise<FiscalRecord> {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Cannot void unknown order ${orderId}`);
    }
    if (order.fiscal_status !== 'fiscalized') {
      throw new Error(`Order ${orderId} is not fiscalized — nothing to void (drafts are deleted, not voided)`);
    }
    const record = await this.allocateRecord('void', {
      orderId,
      order: { total: order.total, tax: order.tax, subtotal: order.subtotal },
      reason,
      registerId: order.register_id ?? null,
      markOrder: 'voided',
    });
    await this.notifyAuthority(record);
    return record;
  }

  async registerReturn(returnId: string, orderId: string): Promise<FiscalRecord> {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Cannot register return against unknown order ${orderId}`);
    }
    if (posConfig.values.fiscalRequireOriginalOnReturn !== false && order.fiscal_status !== 'fiscalized') {
      throw new Error(`Return ${returnId} references order ${orderId} which has no fiscal record`);
    }
    const record = await this.allocateRecord('return', { orderId, returnId });
    await this.notifyAuthority(record);
    return record;
  }

  async closeShift(summary: ShiftFiscalSummary): Promise<FiscalRecord> {
    const record = await this.allocateRecord('z_report', { shiftId: summary.shiftId, shift: summary });
    await this.notifyAuthority(record);
    return record;
  }

  async getRecord(orderId: string): Promise<FiscalRecord | null> {
    const row = await this.repo.findByOrderId(orderId);
    return row ? this.mapRow(row) : null;
  }

  async verifyChain(fromSeq?: number): Promise<ChainVerification> {
    const rows = await this.repo.listByChain(LOCAL_CHAIN_ID, fromSeq);
    if (rows.length === 0) {
      return { ok: true, checked: 0 };
    }

    // Seed prev_hash from the record before the window, or GENESIS for seq 1.
    let prevHash = GENESIS_HASH;
    if (rows[0].seq > 1) {
      const prior = await this.repo.listByChain(LOCAL_CHAIN_ID, rows[0].seq - 1);
      const predecessor = prior.find(r => r.seq === rows[0].seq - 1);
      if (!predecessor) {
        return { ok: false, checked: 0, firstDivergenceSeq: rows[0].seq, reason: 'chain broken before verification window' };
      }
      prevHash = predecessor.hash;
    }

    let checked = 0;
    for (const row of rows) {
      if (row.prev_hash !== prevHash) {
        return { ok: false, checked, firstDivergenceSeq: row.seq, reason: 'prev_hash does not match predecessor' };
      }
      if (sha256Hex(prevHash + row.payload_json) !== row.hash) {
        return { ok: false, checked, firstDivergenceSeq: row.seq, reason: 'record hash mismatch — payload may have been altered' };
      }
      prevHash = row.hash;
      checked++;
    }
    return { ok: true, checked };
  }

  /**
   * Atomic allocation: chain-head read + record insert + head update +
   * order fiscal columns in ONE transaction. A failure rolls all of it
   * back — no consumed numbers, no half-fiscalized orders (R2/R5).
   */
  private async allocateRecord(
    type: FiscalRecordType,
    content: Record<string, unknown> & { orderId?: string; registerId?: string | null; markOrder?: 'voided' }
  ): Promise<FiscalRecord> {
    const recordId = generateUUID();
    // Inside withTransactionAsync calls through the `db` proxy run in the
    // transaction — same convention as OfflineOrderRepository.
    const committed: FiscalRecord[] = [];

    await db.withTransactionAsync(async () => {
      const head = await this.repo.getChainState(db, LOCAL_CHAIN_ID);
      const seq = (head?.last_seq ?? 0) + 1;
      const prevHash = head?.last_hash ?? GENESIS_HASH;
      const createdAt = Date.now();
      const number = this.invoiceNumber(seq);

      // Only legal content is hashed — control fields like markOrder
      // drive the order-row update but are not part of the document.
      const payloadJson = canonicalize({
        id: recordId,
        chainId: LOCAL_CHAIN_ID,
        seq,
        number,
        type,
        createdAt,
        orderId: content.orderId,
        order: content.order,
        returnId: content.returnId,
        shiftId: content.shiftId,
        shift: content.shift,
        registerId: content.registerId,
        reason: content.reason,
      });
      const hash = sha256Hex(prevHash + payloadJson);

      const record: FiscalRecord = {
        id: recordId,
        chainId: LOCAL_CHAIN_ID,
        seq,
        number,
        type,
        orderId: content.orderId ?? null,
        returnId: (content.returnId as string | undefined) ?? null,
        shiftId: (content.shiftId as string | undefined) ?? null,
        registerId: content.registerId ?? null,
        payloadJson,
        prevHash,
        hash,
        createdAt,
      };

      await this.repo.insertRecord(db, {
        id: record.id,
        chain_id: record.chainId,
        seq: record.seq,
        number: record.number,
        type: record.type,
        order_id: record.orderId,
        return_id: record.returnId,
        shift_id: record.shiftId,
        register_id: record.registerId,
        payload_json: record.payloadJson,
        prev_hash: record.prevHash,
        hash: record.hash,
        created_at: record.createdAt,
      });
      await this.repo.upsertChainState(db, LOCAL_CHAIN_ID, seq, hash);

      if (content.orderId) {
        const status = content.markOrder ?? 'fiscalized';
        await db.runAsync('UPDATE orders SET fiscal_status = ?, fiscal_record_id = ?, fiscal_number = ? WHERE id = ?', [
          status,
          recordId,
          number,
          content.orderId,
        ]);
      }

      committed.push(record);
    });

    const record = committed[0];
    if (!record) {
      throw new Error('Fiscal allocation transaction produced no record');
    }
    this.logger.info(`Fiscal record ${record.number} (${type}) chained for order ${content.orderId ?? '—'}`);
    return record;
  }

  private async notifyAuthority(record: FiscalRecord): Promise<void> {
    // Adapter failure must not touch the committed chain record — the
    // authority outbox picks it up on retry.
    await getFiscalAuthorityAdapter(this.jurisdiction)
      .onRecord(record)
      .catch((error: unknown) => {
        this.logger.warn(
          { message: `Authority adapter failed for record ${record.number}` },
          error instanceof Error ? error : new Error(String(error))
        );
      });
  }

  private mapRow(row: FiscalRecordRow): FiscalRecord {
    return {
      id: row.id,
      chainId: row.chain_id,
      seq: row.seq,
      number: row.number,
      type: row.type,
      orderId: row.order_id,
      returnId: row.return_id,
      shiftId: row.shift_id,
      registerId: row.register_id,
      payloadJson: row.payload_json,
      prevHash: row.prev_hash,
      hash: row.hash,
      createdAt: row.created_at,
    };
  }
}

export const offlineFiscalService = new OfflineFiscalService();
