/**
 * BAS-02 regression test on real SQLite — clearing the basket after a sale
 * must reset every customer/sale-scoped field. Before the fix, items and
 * totals were cleared but customer email/name, the note and the sale mode
 * survived, so the next customer's sale inherited them.
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

describe('BAS-02 — clear resets the whole sale scope', () => {
  let service: BasketService;

  beforeEach(async () => {
    await initializeSchema(realDb);
    await realDb.runAsync('DELETE FROM baskets');
    service = new BasketService(new BasketRepository(), logger);
  });

  it('clearBasket removes customer identity, note and sale mode', async () => {
    await service.addItem({ productId: 'p-1', name: 'Widget', price: 10, quantity: 1 });
    await service.setCustomer('vip@example.com', 'Very Important');
    await service.setNote('leave at door');
    await service.setSaleMode('delivery');

    const before = await service.getBasket();
    expect(before.customerEmail).toBe('vip@example.com');
    expect(before.note).toBe('leave at door');

    await service.clearBasket();

    const after = await service.getBasket();
    expect(after.items).toHaveLength(0);
    expect(after.total).toBe(0);
    expect(after.customerEmail).toBeUndefined();
    expect(after.customerName).toBeUndefined();
    expect(after.note).toBeUndefined();
    expect(after.saleMode).toBeUndefined();
    expect(after.discountCode).toBeUndefined();
  });
});
