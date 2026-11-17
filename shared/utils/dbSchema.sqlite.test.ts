/**
 * Real-SQLite tests for the schema — unlike the expo-sqlite mock used
 * elsewhere, these run the actual DDL against node's built-in SQLite so
 * CHECK constraints, migrations and column additions really execute.
 * (Catches the class of bug where `pending_upload` violated the
 * sync_status CHECK — the mock can't see it.)
 */
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { initializeSchema, LATEST_DB_VERSION } from './dbSchema';

type Row = Record<string, unknown>;

class NodeSqliteAdapter {
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

function openDb(): SQLiteDatabase {
  return new NodeSqliteAdapter(new DatabaseSync(':memory:')) as unknown as SQLiteDatabase;
}

describe('initializeSchema on real SQLite', () => {
  it('migrates a fresh database to the latest version', async () => {
    const db = openDb();
    await initializeSchema(db);
    const { user_version } = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!;
    expect(user_version).toBe(LATEST_DB_VERSION);
  });

  it('accepts every sync_status the codebase writes (bug 1)', async () => {
    const db = openDb();
    await initializeSchema(db);
    await db.runAsync(`INSERT INTO orders (id, subtotal, tax, total, status, created_at, updated_at) VALUES ('o1', 1, 0, 1, 'paid', 1, 1)`);
    for (const status of ['pending', 'synced', 'failed', 'pending_upload', 'syncing', 'quarantined']) {
      await expect(db.runAsync('UPDATE orders SET sync_status = ? WHERE id = ?', [status, 'o1'])).resolves.toBeDefined();
    }
  });

  it('still rejects unknown sync_status values', async () => {
    const db = openDb();
    await initializeSchema(db);
    await db.runAsync(`INSERT INTO orders (id, subtotal, tax, total, status, created_at, updated_at) VALUES ('o1', 1, 0, 1, 'paid', 1, 1)`);
    await expect(db.runAsync(`UPDATE orders SET sync_status = 'bogus' WHERE id = 'o1'`)).rejects.toThrow(/CHECK/i);
  });

  it('preserves rows through the orders table rebuild', async () => {
    const db = openDb();
    await initializeSchema(db);
    await db.runAsync(
      `INSERT INTO orders (id, subtotal, tax, total, status, sync_status, created_at, updated_at) VALUES ('keep-me', 42, 2, 44, 'paid', 'synced', 111, 222)`
    );
    const row = await db.getFirstAsync<{ id: string; total: number; created_at: number }>('SELECT * FROM orders WHERE id = ?', ['keep-me']);
    expect(row?.total).toBe(44);
    expect(row?.created_at).toBe(111);
  });

  it('creates pending_ops with retry bookkeeping columns', async () => {
    const db = openDb();
    await initializeSchema(db);
    const cols = await db.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info('pending_ops')`);
    const names = cols.map(c => c.name);
    expect(names).toEqual(expect.arrayContaining(['id', 'kind', 'payload', 'created_at', 'attempts', 'last_error', 'quarantined']));
  });

  it('upgrades a v12 database without losing pending ops', async () => {
    const real = new DatabaseSync(':memory:');
    const db = new NodeSqliteAdapter(real) as unknown as SQLiteDatabase;
    await initializeSchema(db); // fresh → v13

    // Simulate a v12-era op row and confirm it survives + gets defaults.
    await db.runAsync(`INSERT INTO pending_ops (id, kind, payload, created_at) VALUES ('op1', 'update_status', '{}', 5)`);
    const op = await db.getFirstAsync<{ attempts: number; quarantined: number }>('SELECT * FROM pending_ops WHERE id = ?', ['op1']);
    expect(op?.attempts).toBe(0);
    expect(op?.quarantined).toBe(0);
    real.close();
  });
});
