/**
 * DailyReportService — unit tests
 *
 * Tests the pure business logic: order filtering, summary calculation,
 * payment breakdown, and receipt/report formatting.
 * All I/O (KeyValueRepository, ReceiptConfigService, LoggerFactory) is mocked.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────

jest.mock('../../../../shared/services/logger/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: jest.fn(() => ({
      createLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    })),
  },
}));

jest.mock('../../../../shared/repositories/KeyValueRepository', () => ({
  keyValueRepository: {
    getObject: jest.fn().mockResolvedValue(null),
    setObject: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../multi-register/services/InstoreApiConfig', () => ({
  instoreApiConfig: {
    isClient: false,
    current: { registerId: 'test-register' },
  },
}));

jest.mock('../../../platform-clients/services/clients/instoreapi/InstoreApiClient', () => ({
  instoreApiClient: {
    getCurrentShift: jest.fn(),
    getShifts: jest.fn(),
    openShift: jest.fn(),
    closeShift: jest.fn(),
  },
}));

// Minimal receipt config — deterministic output for formatting tests
jest.mock('./ReceiptConfigService', () => ({
  receiptConfigService: {
    getConfig: jest.fn(() => ({
      header: { businessName: 'Test Store', addressLine1: '', addressLine2: '', phone: '', taxId: '' },
      footer: { line1: 'Thank you!', line2: '', line3: '' },
      paperWidth: 32,
    })),
    getDividerLine: jest.fn(() => '--------------------------------'),
    getDoubleDividerLine: jest.fn(() => '================================'),
    centerText: jest.fn((text: string) => text),
    formatLine: jest.fn((label: string, value: string) => `${label} ${value}`),
  },
}));

import { DailyReportService, ShiftData } from './DailyReportService';
import { LocalOrder } from '../../../basket/services/BasketServiceInterface';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeShift(overrides: Partial<ShiftData> = {}): ShiftData {
  const now = Date.now();
  return {
    id: 'shift-1',
    startTime: new Date(now - 3_600_000), // 1 hour ago
    endTime: null,
    cashierName: 'Alice',
    cashierId: 'cashier-1',
    openingCash: 100,
    closingCash: null,
    status: 'open',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<LocalOrder> = {}): LocalOrder {
  return {
    id: `order-${Math.random().toString(36).slice(2)}`,
    platformOrderId: undefined,
    platform: undefined,
    status: 'paid',
    syncStatus: 'synced',
    items: [{ id: 'i1', productId: 'p1', name: 'Widget', price: 10, quantity: 2 }],
    subtotal: 20,
    tax: 1.6,
    total: 21.6,
    discountAmount: 0,
    paymentMethod: 'cash',
    cashierId: 'cashier-1',
    cashierName: 'Alice',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Fresh instance per test — singleton must be reset
function getService(): DailyReportService {
  // Access private static to reset between tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (DailyReportService as any).instance = undefined;
  return DailyReportService.getInstance();
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('DailyReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── openShift / closeShift ─────────────────────────────────────────────

  describe('openShift', () => {
    it('creates a shift with correct fields', async () => {
      const service = getService();
      const shift = await service.openShift('Alice', 'cashier-1', 150);

      expect(shift.cashierName).toBe('Alice');
      expect(shift.cashierId).toBe('cashier-1');
      expect(shift.openingCash).toBe(150);
      expect(shift.status).toBe('open');
      expect(shift.endTime).toBeNull();
    });

    it('throws when a shift is already open', async () => {
      const service = getService();
      await service.openShift('Alice', 'cashier-1', 100);

      await expect(service.openShift('Bob', 'cashier-2', 50)).rejects.toThrow('A shift is already open');
    });

    it('exposes the open shift via getCurrentShift()', async () => {
      const service = getService();
      await service.openShift('Alice', 'cashier-1', 100);

      expect(service.getCurrentShift()).not.toBeNull();
      expect(service.getCurrentShift()?.status).toBe('open');
    });
  });

  describe('closeShift', () => {
    it('closes the shift and clears currentShift', async () => {
      const service = getService();
      await service.openShift('Alice', 'cashier-1', 100);
      const closed = await service.closeShift(220);

      expect(closed.status).toBe('closed');
      expect(closed.closingCash).toBe(220);
      expect(closed.endTime).not.toBeNull();
      expect(service.getCurrentShift()).toBeNull();
    });

    it('throws when no shift is open', async () => {
      const service = getService();
      await expect(service.closeShift(100)).rejects.toThrow('No open shift to close');
    });
  });

  // ── generateDailyReport ────────────────────────────────────────────────

  describe('generateDailyReport', () => {
    it('throws when no shift is available', async () => {
      const service = getService();
      await expect(service.generateDailyReport([])).rejects.toThrow('No shift data available for report');
    });

    it('filters orders to the shift time window', async () => {
      const service = getService();
      const shift = makeShift({
        startTime: new Date(Date.now() - 3_600_000),
        endTime: new Date(),
      });

      const inside = makeOrder({ createdAt: new Date(Date.now() - 1_800_000) });
      const before = makeOrder({ createdAt: new Date(Date.now() - 7_200_000) });
      const after = makeOrder({ createdAt: new Date(Date.now() + 60_000) });

      const report = await service.generateDailyReport([inside, before, after], shift);

      expect(report.orders).toHaveLength(1);
      expect(report.orders[0].id).toBe(inside.id);
    });

    it('filters orders by cashierId when both order and shift have one', async () => {
      const service = getService();
      const shift = makeShift({ cashierId: 'cashier-1' });

      const mine = makeOrder({ cashierId: 'cashier-1' });
      const theirs = makeOrder({ cashierId: 'cashier-2' });

      const report = await service.generateDailyReport([mine, theirs], shift);

      expect(report.orders).toHaveLength(1);
      expect(report.orders[0].id).toBe(mine.id);
    });

    it('includes orders without a cashierId regardless of shift cashier', async () => {
      const service = getService();
      const shift = makeShift({ cashierId: 'cashier-1' });
      const noCashier = makeOrder({ cashierId: undefined });

      const report = await service.generateDailyReport([noCashier], shift);

      expect(report.orders).toHaveLength(1);
    });

    it('calculates totalSales, totalTax, netSales correctly', async () => {
      const service = getService();
      const shift = makeShift();

      const o1 = makeOrder({ total: 21.6, tax: 1.6 });
      const o2 = makeOrder({ total: 10.8, tax: 0.8 });

      const report = await service.generateDailyReport([o1, o2], shift);

      expect(report.summary.totalOrders).toBe(2);
      expect(report.summary.totalSales).toBeCloseTo(32.4, 2);
      expect(report.summary.totalTax).toBeCloseTo(2.4, 2);
      expect(report.summary.netSales).toBeCloseTo(30, 2);
    });

    it('calculates averageOrderValue', async () => {
      const service = getService();
      const shift = makeShift();

      const orders = [makeOrder({ total: 10 }), makeOrder({ total: 20 }), makeOrder({ total: 30 })];

      const report = await service.generateDailyReport(orders, shift);

      expect(report.summary.averageOrderValue).toBeCloseTo(20, 2);
    });

    it('returns averageOrderValue of 0 for empty order list', async () => {
      const service = getService();
      const shift = makeShift();
      const report = await service.generateDailyReport([], shift);

      expect(report.summary.averageOrderValue).toBe(0);
      expect(report.summary.totalOrders).toBe(0);
    });

    it('builds payment breakdown by method', async () => {
      const service = getService();
      const shift = makeShift();

      const orders = [
        makeOrder({ total: 10, paymentMethod: 'cash' }),
        makeOrder({ total: 20, paymentMethod: 'cash' }),
        makeOrder({ total: 15, paymentMethod: 'card' }),
      ];

      const report = await service.generateDailyReport(orders, shift);
      const { paymentBreakdown } = report.summary;

      expect(paymentBreakdown['cash'].count).toBe(2);
      expect(paymentBreakdown['cash'].total).toBeCloseTo(30, 2);
      expect(paymentBreakdown['card'].count).toBe(1);
      expect(paymentBreakdown['card'].total).toBeCloseTo(15, 2);
    });

    it('counts items sold across all orders', async () => {
      const service = getService();
      const shift = makeShift();

      const orders = [
        makeOrder({ items: [{ id: 'i1', productId: 'p1', name: 'A', price: 5, quantity: 3 }] }),
        makeOrder({ items: [{ id: 'i2', productId: 'p2', name: 'B', price: 10, quantity: 2 }] }),
      ];

      const report = await service.generateDailyReport(orders, shift);

      expect(report.summary.itemsSold).toBe(5);
    });

    it('counts refunds (orders with negative total)', async () => {
      const service = getService();
      const shift = makeShift();

      const orders = [makeOrder({ total: 20 }), makeOrder({ total: -10 }), makeOrder({ total: -5 })];

      const report = await service.generateDailyReport(orders, shift);

      expect(report.summary.refunds).toBe(2);
      expect(report.summary.refundAmount).toBeCloseTo(15, 2);
    });

    it('counts totalDiscount from discountAmount fields', async () => {
      const service = getService();
      const shift = makeShift();

      const orders = [makeOrder({ discountAmount: 2 }), makeOrder({ discountAmount: 3 })];

      const report = await service.generateDailyReport(orders, shift);

      expect(report.summary.totalDiscount).toBeCloseTo(5, 2);
    });
  });

  // ── formatDailyReportForPrint ──────────────────────────────────────────

  describe('formatDailyReportForPrint', () => {
    it('returns an array of strings', async () => {
      const service = getService();
      const shift = makeShift({ endTime: new Date() });
      const report = await service.generateDailyReport([makeOrder()], shift);

      const lines = service.formatDailyReportForPrint(report, '£');

      expect(Array.isArray(lines)).toBe(true);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('includes the business name in the header', async () => {
      const service = getService();
      const shift = makeShift();
      const report = await service.generateDailyReport([makeOrder()], shift);

      const lines = service.formatDailyReportForPrint(report, '£');

      expect(lines).toContain('Test Store');
    });

    it('includes DAILY SALES REPORT heading', async () => {
      const service = getService();
      const shift = makeShift();
      const report = await service.generateDailyReport([makeOrder()], shift);

      const lines = service.formatDailyReportForPrint(report, '£');

      expect(lines).toContain('DAILY SALES REPORT');
    });

    it('includes a refund section when refunds exist', async () => {
      const service = getService();
      const shift = makeShift();
      const orders = [makeOrder({ total: -10 })];
      const report = await service.generateDailyReport(orders, shift);

      const lines = service.formatDailyReportForPrint(report, '£');

      expect(lines).toContain('REFUNDS');
    });

    it('omits refund section when there are no refunds', async () => {
      const service = getService();
      const shift = makeShift();
      const report = await service.generateDailyReport([makeOrder()], shift);

      const lines = service.formatDailyReportForPrint(report, '£');

      expect(lines).not.toContain('REFUNDS');
    });
  });

  // ── formatReceiptForPrint ──────────────────────────────────────────────

  describe('formatReceiptForPrint', () => {
    it('returns an array of strings', () => {
      const service = getService();
      const order = makeOrder();
      const lines = service.formatReceiptForPrint(order, '£');

      expect(Array.isArray(lines)).toBe(true);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('includes the business name', () => {
      const service = getService();
      const lines = service.formatReceiptForPrint(makeOrder(), '£');

      expect(lines).toContain('Test Store');
    });

    it('includes the order id (last 8 chars)', () => {
      const service = getService();
      const order = makeOrder({ id: 'abcdef1234567890' });
      const lines = service.formatReceiptForPrint(order, '£');

      const hasOrderId = lines.some(l => l.includes('34567890'));
      expect(hasOrderId).toBe(true);
    });

    it('includes the payment method', () => {
      const service = getService();
      const order = makeOrder({ paymentMethod: 'card' });
      const lines = service.formatReceiptForPrint(order, '£');

      const hasPayment = lines.some(l => l.includes('card'));
      expect(hasPayment).toBe(true);
    });

    it('includes customer name when present', () => {
      const service = getService();
      const order = makeOrder({ customerName: 'Jane Doe' });
      const lines = service.formatReceiptForPrint(order, '£');

      const hasCustomer = lines.some(l => l.includes('Jane Doe'));
      expect(hasCustomer).toBe(true);
    });

    it('includes discount line when discountAmount is set', () => {
      const service = getService();
      const order = makeOrder({ discountAmount: 5 });
      const lines = service.formatReceiptForPrint(order, '£');

      const hasDiscount = lines.some(l => l.includes('Discount'));
      expect(hasDiscount).toBe(true);
    });

    it('omits discount line when discountAmount is 0', () => {
      const service = getService();
      const order = makeOrder({ discountAmount: 0 });
      const lines = service.formatReceiptForPrint(order, '£');

      const hasDiscount = lines.some(l => l.includes('Discount'));
      expect(hasDiscount).toBe(false);
    });
  });
});
