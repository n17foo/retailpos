// Mock uuid to avoid react-native dependency
let uuidCounter = 0;
jest.mock('../../utils/uuid', () => ({
  generateUUID: () => `mock-uuid-${++uuidCounter}`,
}));

// Mock POSConfigService to avoid expo-sqlite dependency
jest.mock('../config/POSConfigService', () => ({
  DEFAULT_TAX_RATE: () => 0.08,
  MAX_SYNC_RETRIES: () => 3,
  posConfig: { values: { taxRate: 0.08, maxSyncRetries: 3, drawerOpenOnCash: true }, load: jest.fn() },
}));

import { BasketService } from './BasketService';
import { BasketRepository } from '../../repositories/BasketRepository';
import { LoggerInterface } from '../logger/LoggerInterface';

// ── Mocks ─────────────────────────────────────────────────────────────

function createMockBasketRepo(): jest.Mocked<BasketRepository> {
  return {
    findActiveBasket: jest.fn().mockResolvedValue(null),
    createBasket: jest.fn(),
    updateBasket: jest.fn(),
    clearBasket: jest.fn(),
  } as any;
}

function createMockLogger(): LoggerInterface {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setLevel: jest.fn(),
    getLevel: jest.fn(),
    createChild: jest.fn(),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('BasketService', () => {
  let service: BasketService;
  let basketRepo: jest.Mocked<BasketRepository>;
  let logger: LoggerInterface;

  beforeEach(() => {
    basketRepo = createMockBasketRepo();
    logger = createMockLogger();
    service = new BasketService(basketRepo, logger);
  });

  describe('initialize', () => {
    it('creates a new basket when none exists', async () => {
      await service.initialize();

      expect(basketRepo.findActiveBasket).toHaveBeenCalled();
      expect(basketRepo.createBasket).toHaveBeenCalledTimes(1);
    });

    it('reuses existing basket', async () => {
      basketRepo.findActiveBasket.mockResolvedValue({
        id: 'existing-1',
        items: '[]',
        subtotal: 0,
        tax: 0,
        total: 0,
        discount_amount: null,
        discount_code: null,
        customer_email: null,
        customer_name: null,
        note: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      await service.initialize();

      expect(basketRepo.createBasket).not.toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('adds a new item and recalculates totals', async () => {
      await service.initialize();

      const basket = await service.addItem({
        productId: 'p1',
        name: 'Test Product',
        price: 10.0,
        quantity: 1,
        taxable: true,
      });

      expect(basket.items).toHaveLength(1);
      expect(basket.items[0].name).toBe('Test Product');
      expect(basket.subtotal).toBe(10.0);
      expect(basket.total).toBeGreaterThan(0);
      expect(basketRepo.updateBasket).toHaveBeenCalled();
    });

    it('increments quantity for duplicate product', async () => {
      // Track saved basket state so subsequent reads return it
      let savedRow: any = null;
      basketRepo.updateBasket.mockImplementation(async (_id, data) => {
        savedRow = {
          id: 'mock-uuid-1', // matches the basket ID created during initialize
          items: data.items,
          subtotal: data.subtotal,
          tax: data.tax,
          total: data.total,
          discount_amount: data.discountAmount,
          discount_code: data.discountCode,
          customer_email: data.customerEmail,
          customer_name: data.customerName,
          note: data.note,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      });
      basketRepo.findActiveBasket.mockImplementation(async () => savedRow);

      await service.initialize();

      await service.addItem({
        productId: 'p1',
        name: 'Test Product',
        price: 10.0,
        quantity: 1,
        taxable: true,
      });

      const basket = await service.addItem({
        productId: 'p1',
        name: 'Test Product',
        price: 10.0,
        quantity: 2,
        taxable: true,
      });

      expect(basket.items).toHaveLength(1);
      expect(basket.items[0].quantity).toBe(3);
    });
  });

  describe('removeItem', () => {
    it('removes an item by id', async () => {
      await service.initialize();

      const basketAfterAdd = await service.addItem({
        productId: 'p1',
        name: 'Test Product',
        price: 10.0,
        quantity: 1,
        taxable: false,
      });

      const itemId = basketAfterAdd.items[0].id;
      const basket = await service.removeItem(itemId);

      expect(basket.items).toHaveLength(0);
      expect(basket.subtotal).toBe(0);
    });
  });

  describe('clearBasket', () => {
    it('delegates to repository', async () => {
      await service.initialize();
      await service.clearBasket();

      expect(basketRepo.clearBasket).toHaveBeenCalled();
    });
  });

  describe('setCustomer', () => {
    it('stores customer info on basket', async () => {
      await service.initialize();

      const basket = await service.setCustomer('test@example.com', 'Test User');

      expect(basket.customerEmail).toBe('test@example.com');
      expect(basket.customerName).toBe('Test User');
    });
  });

  describe('setNote', () => {
    it('stores note on basket', async () => {
      await service.initialize();

      const basket = await service.setNote('Extra napkins please');

      expect(basket.note).toBe('Extra napkins please');
    });
  });
});
