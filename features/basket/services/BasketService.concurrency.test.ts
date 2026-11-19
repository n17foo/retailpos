/**
 * BAS-01 regression test on real SQLite — the basket is persisted as one
 * JSON document, so every mutation must be serialized. Before the fix, two
 * parallel addItem() calls each read the same document, edited their own
 * copy, and wrote it back — the second write clobbered the first and one
 * scanned item silently disappeared.
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

let uuidCounter = 0;
jest.mock('../../../shared/utils/uuid', () => ({
  generateUUID: () => `mock-uuid-${++uuidCounter}`,
}));

jest.mock('../../customers/services/customer/LocalCustomerService', () => ({
  localCustomerService: { upsert: jest.fn().mockResolvedValue('mock-id') },
}));

jest.mock('../../discounts/services/DiscountServiceFactory', () => ({
  DiscountServiceFactory: { getInstance: jest.fn() },
}));

import { db } from '../../../shared/utils/db';
import { initializeSchema } from '../../../shared/utils/dbSchema';
import { BasketService } from './BasketService';
import { BasketRepository } from '../repositories/BasketRepository';
import type { LoggerInterface } from '../../../shared/services/logger/LoggerInterface';

const realDb = db as unknown as SQLiteDatabase;

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  setLevel: jest.fn(),
  getLevel: jest.fn(),
  createChild: jest.fn(),
} as unknown as LoggerInterface;

const item = (productId: string) => ({
  productId,
  variantId: `${productId}-v`,
  name: `Product ${productId}`,
  price: 10,
  quantity: 1,
});

describe('BAS-01 — parallel basket mutations are serialized', () => {
  let service: BasketService;

  beforeEach(async () => {
    await initializeSchema(realDb);
    await realDb.runAsync('DELETE FROM baskets');
    service = new BasketService(new BasketRepository(), logger);
  });

  it('two parallel addItem calls persist both items', async () => {
    const [b1, b2] = await Promise.all([service.addItem(item('p-1')), service.addItem(item('p-2'))]);

    const stored = await service.getBasket();
    expect(stored.items).toHaveLength(2);
    expect(stored.items.map(i => i.productId).sort()).toEqual(['p-1', 'p-2']);
    // Both callers observe a consistent, fully-persisted basket
    expect(new Set([b1.id, b2.id]).size).toBe(1);
    expect(stored.subtotal).toBe(20);
  });

  it('a burst of parallel adds loses no items', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => service.addItem(item(`p-${i}`))));

    const stored = await service.getBasket();
    expect(stored.items).toHaveLength(10);
  });

  it('parallel add and remove run in order — the remove cannot be lost', async () => {
    await service.addItem(item('p-1'));
    const basket = await service.getBasket();
    const itemId = basket.items[0].id;

    // Race a removal against additions on distinct products
    await Promise.all([service.removeItem(itemId), service.addItem(item('p-2')), service.addItem(item('p-3'))]);

    const stored = await service.getBasket();
    expect(stored.items.map(i => i.productId).sort()).toEqual(['p-2', 'p-3']);
  });

  it('parallel quantity updates merge onto the final document', async () => {
    await service.addItem(item('p-1'));
    await service.addItem(item('p-2'));
    const basket = await service.getBasket();

    // Each update applies to the latest document, not a stale copy
    await Promise.all([service.updateItemQuantity(basket.items[0].id, 5), service.updateItemQuantity(basket.items[1].id, 7)]);

    const stored = await service.getBasket();
    const byProduct = new Map(stored.items.map(i => [i.productId, i.quantity]));
    expect(byProduct.get('p-1')).toBe(5);
    expect(byProduct.get('p-2')).toBe(7);
  });
});
