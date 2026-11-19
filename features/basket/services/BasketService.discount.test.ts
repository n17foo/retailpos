/**
 * DIS-01 regression tests on real SQLite — discount services work in cents
 * end to end (see DiscountServiceInterface); BasketService must convert the
 * major-unit subtotal on the way in and the cent discountAmount on the way
 * out. Before the fix, a 5.00 fixed code (value 500 cents) zeroed a 30.00
 * basket and minimum-purchase codes could never apply.
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
import { LocalDiscountService } from '../../discounts/services/LocalDiscountService';
import { DiscountServiceFactory } from '../../discounts/services/DiscountServiceFactory';
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

async function seedDiscount(row: { code: string; type: 'fixed' | 'percentage'; value: number; minimum_purchase?: number }): Promise<void> {
  const now = Date.now();
  await realDb.runAsync(
    `INSERT INTO discounts (code, type, value, description, minimum_purchase, maximum_discount,
       starts_at, expires_at, usage_limit, usage_count, active, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, NULL, 0, 1, ?, ?)`,
    [row.code, row.type, row.value, row.minimum_purchase ?? null, now, now]
  );
}

describe('BasketService discount unit contract (DIS-01)', () => {
  let service: BasketService;

  beforeEach(async () => {
    await initializeSchema(realDb);
    await realDb.runAsync('DELETE FROM baskets');

    const discountService = new LocalDiscountService();
    await discountService.initialize();
    await realDb.runAsync('DELETE FROM discounts');
    (DiscountServiceFactory.getInstance as jest.Mock).mockReturnValue({ getService: () => discountService });

    service = new BasketService(new BasketRepository(), logger);
    await service.initialize();
  });

  it('a 5.00 fixed code discounts 5.00, not the whole basket', async () => {
    await seedDiscount({ code: 'FIXED5', type: 'fixed', value: 500 });
    await service.addItem({ productId: 'p1', name: 'Item', price: 30.0, quantity: 1 });

    const basket = await service.applyDiscount('FIXED5');

    expect(basket.discountAmount).toBe(5.0);
    expect(basket.total).toBe(25.0);
  });

  it('a minimum-purchase code applies when the basket meets the spend', async () => {
    await seedDiscount({ code: 'MIN50', type: 'fixed', value: 500, minimum_purchase: 5000 });
    await service.addItem({ productId: 'p1', name: 'Item', price: 60.0, quantity: 1 });

    const basket = await service.applyDiscount('MIN50');

    expect(basket.discountAmount).toBe(5.0);
    expect(basket.total).toBe(55.0);
  });

  it('rejects a minimum-purchase code below the spend', async () => {
    await seedDiscount({ code: 'MIN50', type: 'fixed', value: 500, minimum_purchase: 5000 });
    await service.addItem({ productId: 'p1', name: 'Item', price: 40.0, quantity: 1 });

    await expect(service.applyDiscount('MIN50')).rejects.toThrow('Minimum purchase');
  });

  it('a 10% code discounts the correct cents amount', async () => {
    await seedDiscount({ code: 'PCT10', type: 'percentage', value: 10 });
    await service.addItem({ productId: 'p1', name: 'Item', price: 25.5, quantity: 1 });

    const basket = await service.applyDiscount('PCT10');

    expect(basket.discountAmount).toBe(2.55);
    expect(basket.total).toBe(22.95);
  });
});
