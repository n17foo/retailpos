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

  async listByChain(chainId: string, fromSeq?: number): Promise<FiscalRecordRow[]> {
    if (fromSeq !== undefined) {
      return db.getAllAsync<FiscalRecordRow>('SELECT * FROM fiscal_records WHERE chain_id = ? AND seq >= ? ORDER BY seq ASC', [
        chainId,
        fromSeq,
      ]);
    }
    return db.getAllAsync<FiscalRecordRow>('SELECT * FROM fiscal_records WHERE chain_id = ? ORDER BY seq ASC', [chainId]);
  }

  /** Enqueue an authority submission for a record (jurisdiction adapters). */
  async enqueueTransmission(id: string, recordId: string, authority: string): Promise<void> {
    await db.runAsync(`INSERT INTO fiscal_transmissions (id, record_id, authority, status, created_at) VALUES (?, ?, ?, 'pending', ?)`, [
      id,
      recordId,
      authority,
      Date.now(),
    ]);
  }
}

export const fiscalRecordRepository = new FiscalRecordRepository();
