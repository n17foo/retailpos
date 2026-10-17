jest.mock('../../utils/uuid', () => ({ generateUUID: () => 'mock-uuid' }));
jest.mock('../config/POSConfigService', () => ({
  MAX_SYNC_RETRIES: () => 3,
  posConfig: { values: { taxRate: 0.08, maxSyncRetries: 3 }, load: jest.fn() },
}));
jest.mock('../customer/LocalCustomerService', () => ({
  localCustomerService: { upsert: jest.fn(), recordOrder: jest.fn() },
}));

import { BasketService } from './BasketService';
import type { BasketRepository } from '../../repositories/BasketRepository';
import type { LoggerInterface } from '../logger/LoggerInterface';

const repo = {
  findActiveBasket: jest.fn().mockResolvedValue(null),
  createBasket: jest.fn(),
  updateBasket: jest.fn(),
  clearBasket: jest.fn(),
} as unknown as jest.Mocked<BasketRepository>;

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as LoggerInterface;

describe('BasketService tax', () => {
  let service: BasketService;

  beforeEach(async () => {
    service = new BasketService(repo, logger);
    await service.initialize();
  });

  it('applies the rate stored on the item', async () => {
    const basket = await service.addItem({ productId: 'p1', name: 'A', price: 10, quantity: 2, taxRate: 0.1 });
    expect(basket.subtotal).toBe(20);
    expect(basket.tax).toBe(2);
    expect(basket.total).toBe(22);
  });

  it('calculates no tax for an item without a rate (no built-in fallback rate)', async () => {
    const basket = await service.addItem({ productId: 'p2', name: 'B', price: 10, quantity: 1 });
    expect(basket.tax).toBe(0);
    expect(basket.total).toBe(10);
  });

  it('calculates no tax for non-taxable items even when a rate is stored', async () => {
    const basket = await service.addItem({ productId: 'p3', name: 'C', price: 10, quantity: 1, taxRate: 0.2, taxable: false });
    expect(basket.tax).toBe(0);
  });
});
