import { type SQLiteDatabase } from 'expo-sqlite';
import { db } from '../../../shared/utils/db';
import type { FiscalRecordType } from '../services/FiscalServiceInterface';

export interface FiscalRecordRow {
  id: string;
  chain_id: string;
  seq: number;
  number: string;
  type: FiscalRecordType;
  order_id: string | null;
  return_id: string | null;
  shift_id: string | null;
  register_id: string | null;
  payload_json: string;
  prev_hash: string;
  hash: string;
  created_at: number;
}

export interface FiscalChainStateRow {
  chain_id: string;
  last_seq: number;
  last_hash: string;
}

export interface FiscalTransmissionRow {
  id: string;
  record_id: string;
  authority: string;
  status: 'pending' | 'sent' | 'failed' | 'dead';
  /** Authority-specific request body built at enqueue time (e.g. AEAT XML + huella). */
  request: string | null;
  response: string | null;
  attempts: number;
  created_at: number;
  sent_at: number | null;
}

/**
 * Reads/writes for the fiscal chain tables. Methods take an explicit
 * database handle so the service can run them inside one transaction —
 * allocate + insert + order update must commit atomically.
 */
export class FiscalRecordRepository {
  async getChainState(dbh: SQLiteDatabase, chainId: string): Promise<FiscalChainStateRow | null> {
    return dbh.getFirstAsync<FiscalChainStateRow>('SELECT * FROM fiscal_chain_state WHERE chain_id = ?', [chainId]);
  }

  async upsertChainState(dbh: SQLiteDatabase, chainId: string, lastSeq: number, lastHash: string): Promise<void> {
    await dbh.runAsync(
      `INSERT INTO fiscal_chain_state (chain_id, last_seq, last_hash) VALUES (?, ?, ?)
       ON CONFLICT(chain_id) DO UPDATE SET last_seq = excluded.last_seq, last_hash = excluded.last_hash`,
      [chainId, lastSeq, lastHash]
    );
  }

  async insertRecord(dbh: SQLiteDatabase, row: FiscalRecordRow): Promise<void> {
    await dbh.runAsync(
      `INSERT INTO fiscal_records
         (id, chain_id, seq, number, type, order_id, return_id, shift_id, register_id, payload_json, prev_hash, hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.chain_id,
        row.seq,
        row.number,
        row.type,
        row.order_id,
        row.return_id,
        row.shift_id,
        row.register_id,
        row.payload_json,
        row.prev_hash,
        row.hash,
        row.created_at,
      ]
    );
  }

  async findById(id: string): Promise<FiscalRecordRow | null> {
    return db.getFirstAsync<FiscalRecordRow>('SELECT * FROM fiscal_records WHERE id = ?', [id]);
  }

  /** The fiscal record produced for an order (sale record, not void/return). */
  async findByOrderId(orderId: string): Promise<FiscalRecordRow | null> {
    return db.getFirstAsync<FiscalRecordRow>(`SELECT * FROM fiscal_records WHERE order_id = ? AND type = 'sale' ORDER BY seq DESC`, [
      orderId,
    ]);
  }

  /** The fiscal record produced for a return — idempotent registration checks (F07). */
  async findByReturnId(returnId: string): Promise<FiscalRecordRow | null> {
    return db.getFirstAsync<FiscalRecordRow>(`SELECT * FROM fiscal_records WHERE return_id = ? AND type = 'return' ORDER BY seq DESC`, [
      returnId,
    ]);
  }

  /** Newest record on a chain — verifyChain reconciles it against fiscal_chain_state (F01). */
  async getTailRecord(chainId: string): Promise<FiscalRecordRow | null> {
    return db.getFirstAsync<FiscalRecordRow>('SELECT * FROM fiscal_records WHERE chain_id = ? ORDER BY seq DESC LIMIT 1', [chainId]);
  }

  /** Whether any authority outbox row exists for a record — repair checks (F03). */
  async hasTransmissionForRecord(recordId: string): Promise<boolean> {
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM fiscal_transmissions WHERE record_id = ?', [recordId]);
    return (row?.n ?? 0) > 0;
  }

  async listByChain(chainId: string, fromSeq?: number): Promise<FiscalRecordRow[]> {
    if (fromSeq !== undefined) {
      return db.getAllAsync<FiscalRecordRow>('SELECT * FROM fiscal_records WHERE chain_id = ? AND seq >= ? ORDER BY seq ASC', [
        chainId,
        fromSeq,
      ]);
    }
    return db.getAllAsync<FiscalRecordRow>('SELECT * FROM fiscal_records WHERE chain_id = ? ORDER BY seq ASC', [chainId]);
  }

  /**
   * Enqueue an authority submission for a record (jurisdiction adapters).
   * Idempotent per (record, authority): retrying/repairing finalization of an
   * already-enqueued record is a no-op rather than a duplicate submission (F03).
   */
  async enqueueTransmission(id: string, recordId: string, authority: string, request?: string): Promise<void> {
    await db.runAsync(
      `INSERT INTO fiscal_transmissions (id, record_id, authority, status, request, created_at)
       SELECT ?, ?, ?, 'pending', ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM fiscal_transmissions WHERE record_id = ? AND authority = ?)`,
      [id, recordId, authority, request ?? null, Date.now(), recordId, authority]
    );
  }

  /** Outbox feed — pending rows plus failed rows still under the retry cap. */
  async listPendingTransmissions(maxAttempts: number, limit = 25): Promise<FiscalTransmissionRow[]> {
    return db.getAllAsync<FiscalTransmissionRow>(
      `SELECT * FROM fiscal_transmissions
       WHERE status = 'pending' OR (status = 'failed' AND attempts < ?)
       ORDER BY created_at ASC LIMIT ?`,
      [maxAttempts, limit]
    );
  }

  async markTransmissionSent(id: string, response: string | null): Promise<void> {
    await db.runAsync(`UPDATE fiscal_transmissions SET status = 'sent', response = ?, attempts = attempts + 1, sent_at = ? WHERE id = ?`, [
      response,
      Date.now(),
      id,
    ]);
  }

  async markTransmissionFailed(id: string, error: string, maxAttempts: number): Promise<void> {
    // attempts is bumped in the same statement; the status flips to 'dead'
    // once the cap is reached — no read-modify-write race.
    await db.runAsync(
      `UPDATE fiscal_transmissions
       SET attempts = attempts + 1,
           response = ?,
           status = CASE WHEN attempts + 1 >= ? THEN 'dead' ELSE 'failed' END
       WHERE id = ?`,
      [error, maxAttempts, id]
    );
  }

  /** The most recent authority request payload for a chain — carries the previous huella for ES encadenamiento. */
  async latestChainTransmission(chainId: string, authority: string): Promise<FiscalTransmissionRow | null> {
    return db.getFirstAsync<FiscalTransmissionRow>(
      `SELECT t.* FROM fiscal_transmissions t
       JOIN fiscal_records r ON r.id = t.record_id
       WHERE r.chain_id = ? AND t.authority = ?
       ORDER BY r.seq DESC LIMIT 1`,
      [chainId, authority]
    );
  }
}

export const fiscalRecordRepository = new FiscalRecordRepository();
