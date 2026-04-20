/**
 * ReportingService — unit tests
 *
 * Tests all aggregation logic: summary stats, hourly/daily bucketing,
 * cashier performance, payment breakdown, and CSV export.
 * The orderRepository is mocked so no SQLite dependency.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────

jest.mock('../logger/LoggerFactory', () => ({
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

jest.mock('../../utils/db', () => ({}));
jest.mock('../../services/instoreapi/InstoreApiConfig', () => ({
  instoreApiConfig: { isClient: false },
}));
jest.mock('../../repositories/OrderRepository', () => ({
  orderRepository: { findByDateRange: jest.fn() },
}));

import { ReportingService } from './ReportingService';
import { orderRepository } from '../../repositories/OrderRepository';

// ── Helpers ───────────────────────────────────────────────────────────────

type PartialOrderRow = {
  id: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  discount_amount: number | null;
  payment_method: string | null;
  cashier_id: string | null;
  cashier_name: string | null;
  created_at: number;
  sync_status: string;
};

function makeRow(overrides: Partial<PartialOrderRow> = {}): PartialOrderRow {
  return {
    id: `order-${Math.random().toString(36).slice(2)}`,
    status: 'paid',
    subtotal: 10,
    tax: 0.8,
    total: 10.8,
    discount_amount: null,
    payment_method: 'cash',
    cashier_id: 'c1',
    cashier_name: 'Alice',
    created_at: Date.now(),
    sync_status: 'synced',
    ...overrides,
  };
}

function getService(): ReportingService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ReportingService as any).instance = undefined;
  return ReportingService.getInstance();
}

// ── getSalesSummary ───────────────────────────────────────────────────────

describe('ReportingService.getSalesSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns zeros for an empty order list', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([]);
    const summary = await getService().getSalesSummary(0, Date.now());

    expect(summary.totalOrders).toBe(0);
    expect(summary.totalSales).toBe(0);
    expect(summary.averageOrderValue).toBe(0);
  });

  it('counts only paid and synced orders', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ status: 'paid' }),
      makeRow({ status: 'synced' }),
      makeRow({ status: 'pending' }),
      makeRow({ status: 'failed' }),
    ]);
    const summary = await getService().getSalesSummary(0, Date.now());

    expect(summary.totalOrders).toBe(2);
  });

  it('sums totalSales, totalTax, and totalDiscount correctly', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ total: 20, tax: 1.6, discount_amount: 2 }),
      makeRow({ total: 10, tax: 0.8, discount_amount: 1 }),
    ]);
    const summary = await getService().getSalesSummary(0, Date.now());

    expect(summary.totalSales).toBeCloseTo(30, 2);
    expect(summary.totalTax).toBeCloseTo(2.4, 2);
    expect(summary.totalDiscount).toBeCloseTo(3, 2);
  });

  it('calculates netSales as totalSales minus totalTax', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([makeRow({ total: 21.6, tax: 1.6 })]);
    const summary = await getService().getSalesSummary(0, Date.now());

    expect(summary.netSales).toBeCloseTo(20, 2);
  });

  it('calculates averageOrderValue', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ total: 10 }),
      makeRow({ total: 20 }),
      makeRow({ total: 30 }),
    ]);
    const summary = await getService().getSalesSummary(0, Date.now());

    expect(summary.averageOrderValue).toBeCloseTo(20, 2);
  });
});

// ── getSalesByHour ────────────────────────────────────────────────────────

describe('ReportingService.getSalesByHour', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 24 buckets regardless of order count', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([]);
    const result = await getService().getSalesByHour(0, Date.now());

    expect(result).toHaveLength(24);
  });

  it('labels buckets as HH:00', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([]);
    const result = await getService().getSalesByHour(0, Date.now());

    expect(result[0].label).toBe('00:00');
    expect(result[9].label).toBe('09:00');
    expect(result[23].label).toBe('23:00');
  });

  it('places orders in the correct hour bucket', async () => {
    const at14h = new Date();
    at14h.setHours(14, 0, 0, 0);

    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ created_at: at14h.getTime(), total: 25 }),
      makeRow({ created_at: at14h.getTime(), total: 15 }),
    ]);
    const result = await getService().getSalesByHour(0, Date.now());
    const bucket14 = result.find(r => r.label === '14:00')!;

    expect(bucket14.orderCount).toBe(2);
    expect(bucket14.totalSales).toBeCloseTo(40, 2);
  });

  it('only counts paid/synced orders', async () => {
    const at10h = new Date();
    at10h.setHours(10, 0, 0, 0);

    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ created_at: at10h.getTime(), status: 'paid', total: 10 }),
      makeRow({ created_at: at10h.getTime(), status: 'pending', total: 99 }),
    ]);
    const result = await getService().getSalesByHour(0, Date.now());
    const bucket10 = result.find(r => r.label === '10:00')!;

    expect(bucket10.orderCount).toBe(1);
    expect(bucket10.totalSales).toBeCloseTo(10, 2);
  });
});

// ── getSalesByDay ─────────────────────────────────────────────────────────

describe('ReportingService.getSalesByDay', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns one entry per distinct day', async () => {
    const day1 = new Date('2024-01-01T10:00:00Z').getTime();
    const day2 = new Date('2024-01-02T10:00:00Z').getTime();

    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ created_at: day1, total: 10 }),
      makeRow({ created_at: day1, total: 20 }),
      makeRow({ created_at: day2, total: 15 }),
    ]);
    const result = await getService().getSalesByDay(0, Date.now());

    expect(result).toHaveLength(2);
  });

  it('sorts results by date ascending', async () => {
    const day1 = new Date('2024-01-01T10:00:00Z').getTime();
    const day3 = new Date('2024-01-03T10:00:00Z').getTime();
    const day2 = new Date('2024-01-02T10:00:00Z').getTime();

    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ created_at: day3 }),
      makeRow({ created_at: day1 }),
      makeRow({ created_at: day2 }),
    ]);
    const result = await getService().getSalesByDay(0, Date.now());

    expect(result[0].label).toBe('2024-01-01');
    expect(result[1].label).toBe('2024-01-02');
    expect(result[2].label).toBe('2024-01-03');
  });
});

// ── getCashierPerformance ─────────────────────────────────────────────────

describe('ReportingService.getCashierPerformance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('groups orders by cashier', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ cashier_id: 'c1', cashier_name: 'Alice', total: 10 }),
      makeRow({ cashier_id: 'c1', cashier_name: 'Alice', total: 20 }),
      makeRow({ cashier_id: 'c2', cashier_name: 'Bob', total: 15 }),
    ]);
    const result = await getService().getCashierPerformance(0, Date.now());

    expect(result).toHaveLength(2);
    const alice = result.find(r => r.cashierId === 'c1')!;
    expect(alice.orderCount).toBe(2);
    expect(alice.totalSales).toBeCloseTo(30, 2);
    expect(alice.averageOrderValue).toBeCloseTo(15, 2);
  });

  it('sorts by totalSales descending', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ cashier_id: 'c1', cashier_name: 'Alice', total: 5 }),
      makeRow({ cashier_id: 'c2', cashier_name: 'Bob', total: 50 }),
    ]);
    const result = await getService().getCashierPerformance(0, Date.now());

    expect(result[0].cashierId).toBe('c2');
  });

  it('uses "unknown" for orders without a cashier_id', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([makeRow({ cashier_id: null, cashier_name: null, total: 10 })]);
    const result = await getService().getCashierPerformance(0, Date.now());

    expect(result[0].cashierId).toBe('unknown');
    expect(result[0].cashierName).toBe('Unknown');
  });
});

// ── getPaymentBreakdown ───────────────────────────────────────────────────

describe('ReportingService.getPaymentBreakdown', () => {
  beforeEach(() => jest.clearAllMocks());

  it('groups orders by payment method', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ payment_method: 'cash', total: 10 }),
      makeRow({ payment_method: 'cash', total: 20 }),
      makeRow({ payment_method: 'card', total: 30 }),
    ]);
    const result = await getService().getPaymentBreakdown(0, Date.now());

    const cash = result.find(r => r.method === 'cash')!;
    const card = result.find(r => r.method === 'card')!;

    expect(cash.count).toBe(2);
    expect(cash.total).toBeCloseTo(30, 2);
    expect(card.count).toBe(1);
    expect(card.total).toBeCloseTo(30, 2);
  });

  it('calculates percentage of grand total', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ payment_method: 'cash', total: 75 }),
      makeRow({ payment_method: 'card', total: 25 }),
    ]);
    const result = await getService().getPaymentBreakdown(0, Date.now());

    const cash = result.find(r => r.method === 'cash')!;
    const card = result.find(r => r.method === 'card')!;

    expect(cash.percentage).toBeCloseTo(75, 1);
    expect(card.percentage).toBeCloseTo(25, 1);
  });

  it('sorts by total descending', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ payment_method: 'cash', total: 10 }),
      makeRow({ payment_method: 'card', total: 50 }),
    ]);
    const result = await getService().getPaymentBreakdown(0, Date.now());

    expect(result[0].method).toBe('card');
  });

  it('uses "unknown" for orders without a payment method', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([makeRow({ payment_method: null, total: 10 })]);
    const result = await getService().getPaymentBreakdown(0, Date.now());

    expect(result[0].method).toBe('unknown');
  });
});

// ── exportOrdersCsv ───────────────────────────────────────────────────────

describe('ReportingService.exportOrdersCsv', () => {
  beforeEach(() => jest.clearAllMocks());

  it('includes a header row', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([]);
    const csv = await getService().exportOrdersCsv(0, Date.now());

    expect(csv).toContain('Order ID');
    expect(csv).toContain('Total');
    expect(csv).toContain('Payment Method');
  });

  it('includes one data row per order', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ id: 'ord-1', total: 10.5 }),
      makeRow({ id: 'ord-2', total: 20.0 }),
    ]);
    const csv = await getService().exportOrdersCsv(0, Date.now());
    const lines = csv.trim().split('\n');

    // header + 2 data rows
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('ord-1');
    expect(lines[2]).toContain('ord-2');
  });

  it('formats totals to 2 decimal places', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([
      makeRow({ id: 'ord-1', total: 9.9, subtotal: 9.0, tax: 0.9, discount_amount: null }),
    ]);
    const csv = await getService().exportOrdersCsv(0, Date.now());

    expect(csv).toContain('9.90');
  });

  it('returns only the header for an empty order list', async () => {
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([]);
    const csv = await getService().exportOrdersCsv(0, Date.now());
    const lines = csv.trim().split('\n');

    expect(lines).toHaveLength(1);
  });
});
