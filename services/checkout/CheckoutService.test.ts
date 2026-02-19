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

// Mock AuditLogService to avoid expo-sqlite dependency
jest.mock('../audit/AuditLogService', () => ({
  auditLogService: { log: jest.fn() },
}));

import { CheckoutService } from './CheckoutService';
import { BasketServiceInterface } from '../basket/BasketServiceInterface';
import { OrderRepository } from '../../repositories/OrderRepository';
import { OrderItemRepository } from '../../repositories/OrderItemRepository';
import { LoggerInterface } from '../logger/LoggerInterface';
import { Basket } from '../basket/basket';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockBasket: Basket = {
  id: 'basket-1',
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      name: 'Widget',
      price: 9.99,
      quantity: 2,
      taxable: true,
    },
  ],
  subtotal: 19.98,
  tax: 1.6,
  total: 21.58,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockBasketService(): BasketServiceInterface {
  return {
    initialize: jest.fn(),
    getBasket: jest.fn().mockResolvedValue(mockBasket),
    addItem: jest.fn(),
    updateItemQuantity: jest.fn(),
    removeItem: jest.fn(),
    clearBasket: jest.fn(),
    applyDiscount: jest.fn(),
    removeDiscount: jest.fn(),
    setCustomer: jest.fn(),
    setNote: jest.fn(),
  };
}

function createMockOrderRepo(): jest.Mocked<OrderRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    findUnsynced: jest.fn().mockResolvedValue([]),
    findByDateRange: jest.fn().mockResolvedValue([]),
    findDistinctCashiers: jest.fn().mockResolvedValue([]),
    updateStatus: jest.fn(),
    updatePayment: jest.fn(),
    updateSyncSuccess: jest.fn(),
    updateSyncError: jest.fn(),
    delete: jest.fn(),
  } as any;
}

function createMockOrderItemRepo(): jest.Mocked<OrderItemRepository> {
  return {
    createMany: jest.fn(),
    findByOrderId: jest.fn().mockResolvedValue([]),
    deleteByOrderId: jest.fn(),
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

describe('CheckoutService', () => {
  let service: CheckoutService;
  let basketService: BasketServiceInterface;
  let orderRepo: jest.Mocked<OrderRepository>;
  let orderItemRepo: jest.Mocked<OrderItemRepository>;
  let logger: LoggerInterface;

  beforeEach(() => {
    basketService = createMockBasketService();
    orderRepo = createMockOrderRepo();
    orderItemRepo = createMockOrderItemRepo();
    logger = createMockLogger();
    service = new CheckoutService(basketService, orderRepo, orderItemRepo, logger);
  });

  describe('startCheckout', () => {
    it('creates an order and order items from the basket', async () => {
      const order = await service.startCheckout(undefined, 'cashier-1', 'Jane');

      expect(orderRepo.create).toHaveBeenCalledTimes(1);
      expect(orderItemRepo.createMany).toHaveBeenCalledTimes(1);

      expect(order.status).toBe('pending');
      expect(order.syncStatus).toBe('pending');
      expect(order.items).toHaveLength(1);
      expect(order.total).toBe(21.58);
      expect(order.cashierId).toBe('cashier-1');
    });

    it('throws when basket is empty', async () => {
      (basketService.getBasket as jest.Mock).mockResolvedValue({ ...mockBasket, items: [] });

      await expect(service.startCheckout()).rejects.toThrow('Cannot checkout with empty basket');
      expect(orderRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('completePayment', () => {
    it('updates order payment and clears basket on success', async () => {
      const result = await service.completePayment('order-1', 'card', 'txn-1');

      expect(result.success).toBe(true);
      expect(orderRepo.updatePayment).toHaveBeenCalledWith('order-1', 'card', 'txn-1');
      expect(basketService.clearBasket).toHaveBeenCalled();
    });

    it('marks order as failed when payment errors', async () => {
      orderRepo.updatePayment.mockRejectedValue(new Error('DB write failed'));

      const result = await service.completePayment('order-1', 'card');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB write failed');
      expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-1', 'failed');
    });
  });

  describe('cancelOrder', () => {
    it('sets status to cancelled', async () => {
      await service.cancelOrder('order-1');
      expect(orderRepo.updateStatus).toHaveBeenCalledWith('order-1', 'cancelled');
    });
  });

  describe('getLocalOrders', () => {
    it('returns mapped orders', async () => {
      orderRepo.findAll.mockResolvedValue([
        {
          id: 'o1',
          platform_order_id: null,
          platform: null,
          subtotal: 10,
          tax: 0.8,
          total: 10.8,
          discount_amount: null,
          discount_code: null,
          customer_email: null,
          customer_name: null,
          note: null,
          payment_method: 'cash',
          payment_transaction_id: null,
          cashier_id: null,
          cashier_name: null,
          status: 'paid',
          sync_status: 'pending',
          sync_error: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          paid_at: Date.now(),
          synced_at: null,
        },
      ]);

      const orders = await service.getLocalOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe('o1');
      expect(orders[0].status).toBe('paid');
    });
  });
});
