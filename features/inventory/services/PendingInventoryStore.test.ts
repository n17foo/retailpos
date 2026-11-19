/**
 * INV-02 regression tests on real SQLite — the pending-inventory queue is a
 * single JSON value, so adds/removes must be serialized. Before the fix, two
 * parallel add() calls each read the same document and the last writer won —
 * receiving/counting adjustments silently disappeared.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => {
  const { openDb } = require('../../../tests/helpers/nodeSqliteAdapter');
  const real = openDb();
  return {
    openDatabaseAsync: jest.fn(async () => real),
    openDatabaseSync: jest.fn(() => real),
  };
});

import { db } from '../../../shared/utils/db';
import { initializeSchema } from '../../../shared/utils/dbSchema';
import { PendingInventoryStore, PendingInventoryUpdate } from './PendingInventoryStore';
import type { InventoryUpdate } from './InventoryServiceInterface';

const realDb = db as unknown as SQLiteDatabase;

const upd = (productId: string, quantity: number, adjustment = true): InventoryUpdate => ({
  productId,
  quantity,
  adjustment,
});

describe('INV-02 — concurrent pending-inventory writes lose nothing', () => {
  let store: PendingInventoryStore;

  beforeEach(async () => {
    await initializeSchema(realDb);
    await realDb.runAsync('DELETE FROM key_value_store');
    store = new PendingInventoryStore();
  });

  it('parallel adds for different products all survive', async () => {
    await Promise.all([
      store.add('shopify', [upd('p-1', 10)]),
      store.add('shopify', [upd('p-2', 20)]),
      store.add('shopify', [upd('p-3', 30)]),
    ]);

    expect(await store.count('shopify')).toBe(3);
  });

  it('an enqueue during a drain is not overwritten by the drain', async () => {
    await store.add('shopify', [upd('p-1', 10)]);
    const queued = await store.list('shopify');

    // Race: remove the queued entry while a new failure lands
    await Promise.all([store.remove('shopify', queued), store.add('shopify', [upd('p-2', 99)])]);

    const remaining = await store.list('shopify');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].update.productId).toBe('p-2');
  });

  it('absolute updates still coalesce per item under serialization', async () => {
    await Promise.all([
      store.add('shopify', [upd('p-1', 5, false)]),
      store.add('shopify', [upd('p-1', 50, false)]),
      store.add('shopify', [upd('p-2', 7, false)]),
    ]);

    const entries = await store.list('shopify');
    const forP1 = entries.filter(e => e.update.productId === 'p-1');
    // Latest absolute value wins — whichever serialized second survives;
    // the point is one coalesced entry, not duplicates.
    expect(forP1).toHaveLength(1);
    expect([5, 50]).toContain(forP1[0].update.quantity);
    expect(entries).toHaveLength(2);
  });

  it('delta updates append independently — none are lost', async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => store.add('shopify', [upd(`p-${i}`, i)])));

    const entries: PendingInventoryUpdate[] = await store.list('shopify');
    expect(entries).toHaveLength(8);
  });
});
