/**
 * INV-01 regression — offline inventory keyed by productId alone merged
 * distinct variants: setting v1=10 then v2=20 left a single row at 20.
 * Variant updates must keep composite product/variant identity.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => {
  const { openDb } = require('../../../../tests/helpers/nodeSqliteAdapter');
  const real = openDb();
  return {
    openDatabaseAsync: jest.fn(async () => real),
    openDatabaseSync: jest.fn(() => real),
  };
});

import { db } from '../../../../shared/utils/db';
import { initializeSchema } from '../../../../shared/utils/dbSchema';
import { keyValueRepository } from '../../../../shared/repositories/KeyValueRepository';
import { OfflineInventoryService } from './OfflineInventoryService';

const realDb = db as unknown as SQLiteDatabase;

async function freshService(): Promise<OfflineInventoryService> {
  const service = new OfflineInventoryService();
  await service.initialize();
  return service;
}

beforeEach(async () => {
  await initializeSchema(realDb);
  await keyValueRepository.removeItem('offline_local_inventory');
});

describe('INV-01 — variant-level stock identity', () => {
  it('keeps two variants of the same product as separate stock lines', async () => {
    const service = await freshService();

    await service.updateInventory([
      { productId: 'prod-1', variantId: 'v1', quantity: 10 },
      { productId: 'prod-1', variantId: 'v2', quantity: 20 },
    ]);

    const { items } = await service.getInventory(['prod-1']);
    expect(items).toHaveLength(2);
    const byVariant = Object.fromEntries(items.map(i => [i.variantId, i.quantity]));
    expect(byVariant).toEqual({ v1: 10, v2: 20 });
  });

  it('adjustments apply to the targeted variant only', async () => {
    const service = await freshService();

    await service.updateInventory([
      { productId: 'prod-1', variantId: 'v1', quantity: 10 },
      { productId: 'prod-1', variantId: 'v2', quantity: 20 },
    ]);
    await service.updateInventory([{ productId: 'prod-1', variantId: 'v1', quantity: -3, adjustment: true }]);

    const { items } = await service.getInventory(['prod-1']);
    const byVariant = Object.fromEntries(items.map(i => [i.variantId, i.quantity]));
    expect(byVariant).toEqual({ v1: 7, v2: 20 });
  });

  it('a legacy product-level row and a new variant row coexist', async () => {
    // Seed a legacy-format row: productId key, sku holding whatever the old
    // code had stored there (possibly a variant id — not inferred either way).
    await keyValueRepository.setItem(
      'offline_local_inventory',
      JSON.stringify({ 'prod-1': { quantity: 5, sku: 'v-legacy', updatedAt: new Date().toISOString() } })
    );

    const service = await freshService();
    await service.updateInventory([{ productId: 'prod-1', variantId: 'v2', quantity: 20 }]);

    const { items } = await service.getInventory(['prod-1']);
    expect(items).toHaveLength(2);
    const legacy = items.find(i => i.variantId === undefined);
    const variant = items.find(i => i.variantId === 'v2');
    expect(legacy?.quantity).toBe(5);
    expect(legacy?.sku).toBe('v-legacy');
    expect(variant?.quantity).toBe(20);
  });

  it('round-trips variant rows through persistence', async () => {
    const first = await freshService();
    await first.updateInventory([
      { productId: 'prod-1', variantId: 'v1', quantity: 10 },
      { productId: 'prod-1', variantId: 'v2', quantity: 20 },
    ]);

    const second = await freshService();
    const { items } = await second.getInventory(['prod-1']);
    expect(items).toHaveLength(2);
    expect(Object.fromEntries(items.map(i => [i.variantId, i.quantity]))).toEqual({ v1: 10, v2: 20 });

    const all = await second.getAllInventory();
    expect(all.items.filter(i => i.productId === 'prod-1')).toHaveLength(2);
  });
});
