import { db } from '../../../shared/utils/db';
import { sha256Hex } from '../../../shared/utils/crypto';
import { generateUUID } from '../../../shared/utils/uuid';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';
import { posConfig } from '../../platform-clients/services/config/POSConfigService';
import { orderRepository } from '../../orders-sync/repositories/OrderRepository';
import { getReturnRepository } from '../../returns/repositories/ReturnRepository';
import { fiscalRecordRepository, FiscalRecordRow } from '../repositories/FiscalRecordRepository';
import { canonicalize } from './FiscalCanonicalizer';
import { getFiscalAuthorityAdapter } from './authorities/getFiscalAuthorityAdapter';
import type { FiscalAuthorityAdapter, FiscalAuthorityOutcome } from './authorities/FiscalAuthorityAdapter';
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
    // Resolve the authority adapter BEFORE allocating — an unsupported
    // jurisdiction (IT without a certified partner) must leave the order
    // 'unfinalized', not stamp a record that can never be legal.
    const adapter = getFiscalAuthorityAdapter(this.jurisdiction);

    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Cannot fiscalize unknown order ${orderId}`);
    }
    if (order.fiscal_status === 'fiscalized') {
      // Idempotent — recovery re-running finalize returns the existing
      // record, but first repairs any authority work an older version or
      // a crash left missing (F03).
      const existing = await this.repo.findByOrderId(orderId);
      if (existing) {
        const record = this.mapRow(existing);
        return this.applyAuthorityOutcome(record, await this.ensureAuthorityWork(record, adapter));
      }
      throw new Error(`Order ${orderId} is stamped fiscalized but has no sale record — ledger integrity failure`);
    }
    if (order.status !== 'paid' && order.status !== 'synced') {
      throw new Error(`Cannot fiscalize order ${orderId} in status '${order.status}' — payment must be recorded first`);
    }

    const { record, outcome } = await this.allocateRecord(
      'sale',
      {
        orderId,
        order: {
          total: order.total,
          tax: order.tax,
          subtotal: order.subtotal,
          paymentMethod: order.payment_method,
        },
        registerId: order.register_id ?? null,
      },
      adapter
    );
    return this.applyAuthorityOutcome(record, outcome);
  }

  async voidOrder(orderId: string, reason: string): Promise<FiscalRecord> {
    const adapter = getFiscalAuthorityAdapter(this.jurisdiction);
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Cannot void unknown order ${orderId}`);
    }
    if (order.fiscal_status !== 'fiscalized') {
      throw new Error(`Order ${orderId} is not fiscalized — nothing to void (drafts are deleted, not voided)`);
    }
    const { record, outcome } = await this.allocateRecord(
      'void',
      {
        orderId,
        order: { total: order.total, tax: order.tax, subtotal: order.subtotal },
        reason,
        registerId: order.register_id ?? null,
        markOrder: 'voided',
      },
      adapter
    );
    return this.applyAuthorityOutcome(record, outcome);
  }

  async registerReturn(returnId: string, orderId: string): Promise<FiscalRecord> {
    const adapter = getFiscalAuthorityAdapter(this.jurisdiction);
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Cannot register return against unknown order ${orderId}`);
    }
    if (posConfig.values.fiscalRequireOriginalOnReturn !== false && order.fiscal_status !== 'fiscalized') {
      throw new Error(`Return ${returnId} references order ${orderId} which has no fiscal record`);
    }

    // Idempotent per return ID — a retried registration returns the same
    // record and repairs any missing authority work (F07/F03).
    const existing = await this.repo.findByReturnId(returnId);
    if (existing) {
      const record = this.mapRow(existing);
      return this.applyAuthorityOutcome(record, await this.ensureAuthorityWork(record, adapter));
    }

    // The immutable payload must carry the ACTUAL refunded amounts (F07):
    // load the persisted return row and verify it belongs to this order —
    // an arbitrary return ID can never be fiscalized.
    const returnRow = await getReturnRepository().findById(returnId);
    if (!returnRow) {
      throw new Error(`Cannot register return ${returnId} — no such return exists`);
    }
    if (returnRow.order_id !== orderId) {
      throw new Error(`Return ${returnId} belongs to order ${returnRow.order_id}, not ${orderId}`);
    }

    const { record, outcome } = await this.allocateRecord(
      'return',
      {
        orderId,
        returnId,
        order: { total: returnRow.refund_amount, tax: 0, subtotal: returnRow.refund_amount },
        returnDetails: {
          refundAmount: returnRow.refund_amount,
          quantity: returnRow.quantity,
          productId: returnRow.product_id,
          productName: returnRow.product_name,
        },
      },
      adapter
    );
    return this.applyAuthorityOutcome(record, outcome);
  }

  async closeShift(summary: ShiftFiscalSummary): Promise<FiscalRecord> {
    const adapter = getFiscalAuthorityAdapter(this.jurisdiction);
    const { record, outcome } = await this.allocateRecord('z_report', { shiftId: summary.shiftId, shift: summary }, adapter);
    return this.applyAuthorityOutcome(record, outcome);
  }

  /**
   * Durable recovery for paid-but-unfiscalized orders (F04): a checkout
   * whose fiscalization failed leaves the order 'paid'/'unfinalized'; this
   * scan retries finalization so no confirmed sale can stay without a
   * fiscal record. Called by the transmission drainer (standalone only —
   * in client mode the Store API reconciles its own chain).
   */
  async reconcileUnfinalizedOrders(): Promise<number> {
    if (!posConfig.values.fiscalEnabled) {
      return 0;
    }
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM orders
       WHERE status IN ('paid', 'synced') AND (fiscal_status IS NULL OR fiscal_status = 'unfinalized')
       ORDER BY created_at ASC`
    );
    let finalized = 0;
    for (const row of rows) {
      try {
        await this.finalizeSale(row.id);
        finalized++;
      } catch (err) {
        this.logger.warn(
          { message: `Fiscal reconciliation could not finalize order ${row.id}` },
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }
    return finalized;
  }

  async getRecord(orderId: string): Promise<FiscalRecord | null> {
    const row = await this.repo.findByOrderId(orderId);
    return row ? this.mapRow(row) : null;
  }

  async verifyChain(fromSeq?: number): Promise<ChainVerification> {
    const rows = await this.repo.listByChain(LOCAL_CHAIN_ID, fromSeq);
    const state = await this.repo.getChainState(db, LOCAL_CHAIN_ID);
    const tail = await this.repo.getTailRecord(LOCAL_CHAIN_ID);

    // Empty-ledger/head consistency: a recorded chain head with no
    // surviving records means the ledger was wiped (F01).
    if (rows.length === 0) {
      if (state && state.last_seq > 0) {
        return { ok: false, checked: 0, firstDivergenceSeq: 1, reason: 'fiscal_chain_state records a head but the ledger is empty' };
      }
      return { ok: true, checked: 0 };
    }
    if (!state) {
      return { ok: false, checked: 0, firstDivergenceSeq: rows[0].seq, reason: 'fiscal_chain_state head is missing' };
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
    let expectedSeq = rows[0].seq;
    for (const row of rows) {
      if (row.seq !== expectedSeq) {
        return {
          ok: false,
          checked,
          firstDivergenceSeq: row.seq,
          reason: `non-contiguous sequence — expected seq ${expectedSeq}, found ${row.seq}`,
        };
      }
      if (row.prev_hash !== prevHash) {
        return { ok: false, checked, firstDivergenceSeq: row.seq, reason: 'prev_hash does not match predecessor' };
      }
      if (sha256Hex(prevHash + row.payload_json) !== row.hash) {
        return { ok: false, checked, firstDivergenceSeq: row.seq, reason: 'record hash mismatch — payload may have been altered' };
      }
      const fieldError = this.verifyPayloadFields(row);
      if (fieldError) {
        return { ok: false, checked, firstDivergenceSeq: row.seq, reason: fieldError };
      }
      prevHash = row.hash;
      expectedSeq++;
      checked++;
    }

    // Tail/head reconciliation — the newest surviving record must equal
    // the recorded head. A tail deletion leaves state.last_seq ahead of
    // the ledger; a head rewrite leaves the hashes mismatched (F01).
    if (!tail || state.last_seq !== tail.seq || state.last_hash !== tail.hash) {
      return {
        ok: false,
        checked,
        firstDivergenceSeq: tail ? Math.min(tail.seq, state.last_seq) : state.last_seq,
        reason: 'fiscal_chain_state head does not match the verified chain tail',
      };
    }

    return { ok: true, checked };
  }

  /**
   * The hashed payload is the source of truth: every field duplicated
   * into relational columns (which mapRow() and queries actually use)
   * must match it, or someone tampered with the ledger metadata (F01).
   */
  private verifyPayloadFields(row: FiscalRecordRow): string | null {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    } catch {
      return 'payload_json is not valid JSON';
    }
    const checks: Array<[unknown, unknown, string]> = [
      [payload.id, row.id, 'id'],
      [payload.chainId, row.chain_id, 'chainId'],
      [payload.seq, row.seq, 'seq'],
      [payload.number, row.number, 'number'],
      [payload.type, row.type, 'type'],
      [payload.orderId ?? null, row.order_id, 'orderId'],
      [payload.returnId ?? null, row.return_id, 'returnId'],
      [payload.shiftId ?? null, row.shift_id, 'shiftId'],
      [payload.registerId ?? null, row.register_id, 'registerId'],
      [payload.createdAt, row.created_at, 'createdAt'],
    ];
    for (const [payloadValue, columnValue, field] of checks) {
      if (payloadValue !== columnValue) {
        return `payload field '${field}' does not match the ledger column — metadata tampered`;
      }
    }
    return null;
  }

  /**
   * Atomic allocation: chain-head read + record insert + head update +
   * order fiscal columns + the authority-outbox intent in ONE transaction.
   * A failure rolls all of it back — no consumed numbers, no
   * half-fiscalized orders, and no committed record without its authority
   * work (R2/R5, F03).
   */
  private async allocateRecord(
    type: FiscalRecordType,
    content: Record<string, unknown> & { orderId?: string; registerId?: string | null; markOrder?: 'voided' },
    adapter: FiscalAuthorityAdapter
  ): Promise<{ record: FiscalRecord; outcome: FiscalAuthorityOutcome | undefined }> {
    const recordId = generateUUID();
    // Inside withTransactionAsync calls through the `db` proxy run in the
    // transaction — same convention as OfflineOrderRepository.
    const committed: FiscalRecord[] = [];
    let outcome: FiscalAuthorityOutcome | undefined;

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
        returnDetails: content.returnDetails,
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

      // Only the original sale claims the order's fiscal identity.
      // Corrections link back through their own records — a return never
      // replaces the sale's invoice number/id (F02); a void updates the
      // status only, keeping the original fiscal_record_id/fiscal_number.
      if (content.orderId && type === 'sale') {
        await db.runAsync('UPDATE orders SET fiscal_status = ?, fiscal_record_id = ?, fiscal_number = ? WHERE id = ?', [
          'fiscalized',
          recordId,
          number,
          content.orderId,
        ]);
      } else if (content.orderId && content.markOrder === 'voided') {
        await db.runAsync(`UPDATE orders SET fiscal_status = 'voided' WHERE id = ?`, [content.orderId]);
      }

      // Authority work commits atomically with the ledger record — an
      // adapter failure aborts the whole allocation so nothing fiscalized
      // can exist without its retryable outbox intent (F03).
      outcome = await adapter.onRecord(record);

      committed.push(record);
    });

    const record = committed[0];
    if (!record) {
      throw new Error('Fiscal allocation transaction produced no record');
    }
    this.logger.info(`Fiscal record ${record.number} (${type}) chained for order ${content.orderId ?? '—'}`);
    return { record, outcome };
  }

  /**
   * Repair path for records committed before the outbox intent was atomic:
   * if a committed record has no authority work, rebuild it now.
   * enqueueTransmission is idempotent, so a live re-run never duplicates (F03).
   */
  private async ensureAuthorityWork(record: FiscalRecord, adapter: FiscalAuthorityAdapter): Promise<FiscalAuthorityOutcome | undefined> {
    if (await this.repo.hasTransmissionForRecord(record.id)) {
      return adapter.receiptOutcome?.(record);
    }
    return adapter.onRecord(record);
  }

  private applyAuthorityOutcome(record: FiscalRecord, outcome: FiscalAuthorityOutcome | undefined): FiscalRecord {
    if (outcome?.receiptQrUrl) {
      record.authorityQr = outcome.receiptQrUrl;
    }
    return record;
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
