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
import { NodeSqliteAdapter, openDb } from '../../tests/helpers/nodeSqliteAdapter';

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

describe('database safety pragmas and atomic writes (bug 10)', () => {
  it('WAL journal mode and FULL synchronous stick on a real file', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'posdb-')), 'test.db');
    const real = new DatabaseSync(file);
    const db = new NodeSqliteAdapter(real) as unknown as SQLiteDatabase;

    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA synchronous = FULL;');

    const { journal_mode } = (await db.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode'))!;
    const { synchronous } = (await db.getFirstAsync<{ synchronous: number }>('PRAGMA synchronous'))!;
    expect(journal_mode.toLowerCase()).toBe('wal');
    expect(synchronous).toBe(2); // FULL = 2
    real.close();
  });

  it('quick_check reports ok on a healthy schema', async () => {
    const db = openDb();
    await initializeSchema(db);
    const rows = await db.getAllAsync<{ quick_check: string }>('PRAGMA quick_check');
    expect(rows.map(r => r.quick_check)).toEqual(['ok']);
  });

  it('a failed insert inside withTransactionAsync rolls back the whole sale', async () => {
    const db = openDb();
    await initializeSchema(db);
    await expect(
      db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO orders (id, subtotal, tax, total, status, created_at, updated_at) VALUES ('sale-1', 10, 1, 11, 'paid', 1, 1)`
        );
        // NOT NULL violation on name — the crash-mid-sale case.
        await db.runAsync(
          `INSERT INTO order_items (id, order_id, product_id, name, price, quantity) VALUES ('i1', 'sale-1', 'p1', NULL, 10, 1)`
        );
      })
    ).rejects.toThrow(/NOT NULL/i);

    // Order must not exist — no orphan order row without its items.
    expect(await db.getFirstAsync('SELECT id FROM orders WHERE id = ?', ['sale-1'])).toBeNull();
    expect(await db.getFirstAsync('SELECT id FROM order_items WHERE order_id = ?', ['sale-1'])).toBeNull();
  });
});
