/**
 * expo-sqlite-shaped adapter over node's built-in SQLite — lets Jest suites
 * exercise the real schema, CHECK constraints and transactions instead of the
 * blanket expo-sqlite mock. Used by the *.sqlite.test.ts suites.
 */
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

type Row = Record<string, unknown>;

export class NodeSqliteAdapter {
  constructor(private readonly db: DatabaseSync) {}

  async runAsync(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.db.prepare(sql).run(...(params as never[]));
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async getFirstAsync<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
    const row = this.db.prepare(sql).get(...(params as never[]));
    return (row as T) ?? null;
  }

  async getAllAsync<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as T[];
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }

  async withTransactionAsync(fn: (txn: this) => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await fn(this);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function openDb(): SQLiteDatabase {
  return new NodeSqliteAdapter(new DatabaseSync(':memory:')) as unknown as SQLiteDatabase;
}
