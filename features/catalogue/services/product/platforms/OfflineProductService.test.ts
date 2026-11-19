/**
 * CAT-01 regression — untracked products must be filtered by availability,
 * not by stock: a tracked variant needs inventoryQuantity > 0, an
 * untracked one uses its isAvailable flag.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => {
  const { openDb } = require('../../../../../tests/helpers/nodeSqliteAdapter');
  const real = openDb();
  return {
    openDatabaseAsync: jest.fn(async () => real),
    openDatabaseSync: jest.fn(() => real),
  };
});

import { db } from '../../../../../shared/utils/db';
import { initializeSchema } from '../../../../../shared/utils/dbSchema';
import { keyValueRepository } from '../../../../../shared/repositories/KeyValueRepository';
import { OfflineProductService } from './OfflineProductService';
import type { Product } from '../ProductServiceInterface';

const realDb = db as unknown as SQLiteDatabase;

const product = (id: string, variants: Product['variants']): Product => ({
  id,
  title: `Product ${id}`,
  variants,
});

const variant = (id: string, qty: number, trackInventory?: boolean, isAvailable?: boolean): Product['variants'][number] => ({
  id,
  price: 10,
  inventoryQuantity: qty,
  trackInventory,
  isAvailable,
});

beforeEach(async () => {
  await initializeSchema(realDb);
  await keyValueRepository.removeItem('offline_local_products');
});

async function serviceWith(products: Product[]): Promise<OfflineProductService> {
  await keyValueRepository.setItem('offline_local_products', JSON.stringify(products));
  const service = new OfflineProductService();
  await service.initialize();
  return service;
}

describe('CAT-01 — untracked availability is not "out of stock"', () => {
  it('lists an available untracked product whose quantity is zero', async () => {
    const service = await serviceWith([
      product('svc-1', [variant('v1', 0, false, true)]),
      product('t-1', [variant('v2', 0, true)]), // tracked, empty — excluded
    ]);

    const result = await service.getProducts({});
    expect(result.products.map(p => p.id)).toEqual(['svc-1']);
  });

  it('hides an untracked product the platform marked unavailable', async () => {
    const service = await serviceWith([product('svc-2', [variant('v1', 0, false, false)])]);
    const result = await service.getProducts({});
    expect(result.products).toHaveLength(0);
  });

  it('mixed variants — one tracked-in-stock variant keeps the product listed', async () => {
    const service = await serviceWith([product('mix-1', [variant('v1', 0, false, false), variant('v2', 3, true)])]);
    const result = await service.getProducts({});
    expect(result.products.map(p => p.id)).toEqual(['mix-1']);
  });

  it('includeOutOfStock still returns everything', async () => {
    const service = await serviceWith([product('o1', [variant('v1', 0, true)]), product('o2', [variant('v2', 0, false, false)])]);
    const result = await service.getProducts({ includeOutOfStock: true });
    expect(result.products).toHaveLength(2);
  });
});
