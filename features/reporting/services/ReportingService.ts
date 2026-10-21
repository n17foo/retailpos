import { getOrderRepository, OrderRow } from '../../orders-sync/repositories/OrderRepository';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';
import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';
import { toCents, toDollars, roundMoney, subtractMoney } from '../../../shared/utils/money';
import { toCsv } from '../../../shared/utils/csv';

export interface SalesSummary {
  totalOrders: number;
  totalSales: number;
  totalTax: number;
  totalDiscount: number;
  netSales: number;
  averageOrderValue: number;
}

export interface SalesByPeriod {
  label: string;
  orderCount: number;
  totalSales: number;
}

export interface CashierPerformance {
  cashierId: string;
  cashierName: string;
  orderCount: number;
  totalSales: number;
  averageOrderValue: number;
}

export interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
  percentage: number;
}

export interface RegisterPerformance {
  registerId: string;
  orderCount: number;
  totalSales: number;
}

/** Everything the reporting screen needs for one date range, in a single fetch */
export interface SalesReport {
  summary: SalesSummary;
  salesByHour: SalesByPeriod[];
  salesByDay: SalesByPeriod[];
  cashierPerformance: CashierPerformance[];
  paymentBreakdown: PaymentBreakdown[];
  salesByRegister: RegisterPerformance[];
}

interface PaymentLine {
  method?: string;
  amount?: number;
}

function isReportable(order: OrderRow): boolean {
  return order.status === 'paid' || order.status === 'synced';
}

function localDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Reporting service — queries the active OrderRepository for analytics data.
 * Standalone/offline → local SQLite. Client register → the Store API,
 * aggregated server-side (store-wide across all registers) so report data
 * never depends on a client's empty local orders table.
 */
export class ReportingService {
  private static instance: ReportingService;
  private logger = LoggerFactory.getInstance().createLogger('ReportingService');

  private constructor() {}

  static getInstance(): ReportingService {
    if (!ReportingService.instance) {
      ReportingService.instance = new ReportingService();
    }
    return ReportingService.instance;
  }

  private async fetchPaidOrders(from: number, to: number): Promise<OrderRow[]> {
    const orders = await getOrderRepository().findByDateRange(from, to);
    return orders.filter(isReportable);
  }

  /**
   * Load the full report in one shot. In client mode this is a single
   * /api/reports/sales call (aggregated on the server); standalone computes
   * locally from one orders query. Day/hour buckets use the register's
   * local timezone in both modes.
   */
  async getFullReport(from: number, to: number): Promise<SalesReport> {
    if (instoreApiConfig.isClient) {
      const report = await instoreApiClient.getSalesReport(from, to);
      return report;
    }
    const orders = await this.fetchPaidOrders(from, to);
    return {
      summary: this.computeSummary(orders),
      salesByHour: this.computeByHour(orders),
      salesByDay: this.computeByDay(orders),
      cashierPerformance: this.computeByCashier(orders),
      paymentBreakdown: this.computePaymentBreakdown(orders),
      salesByRegister: this.computeByRegister(orders),
    };
  }

  /** Summary stats for a date range */
  async getSalesSummary(from: number, to: number): Promise<SalesSummary> {
    return this.computeSummary(await this.fetchPaidOrders(from, to));
  }

  /** Sales grouped by hour for a single day */
  async getSalesByHour(dayStart: number, dayEnd: number): Promise<SalesByPeriod[]> {
    return this.computeByHour(await this.fetchPaidOrders(dayStart, dayEnd));
  }

  /** Sales grouped by day for a date range */
  async getSalesByDay(from: number, to: number): Promise<SalesByPeriod[]> {
    return this.computeByDay(await this.fetchPaidOrders(from, to));
  }

  /** Cashier performance for a date range */
  async getCashierPerformance(from: number, to: number): Promise<CashierPerformance[]> {
    return this.computeByCashier(await this.fetchPaidOrders(from, to));
  }

  /** Payment method breakdown for a date range (split-tender aware) */
  async getPaymentBreakdown(from: number, to: number): Promise<PaymentBreakdown[]> {
    return this.computePaymentBreakdown(await this.fetchPaidOrders(from, to));
  }

  /** Sales grouped by register (multi-register deployments) */
  async getSalesByRegister(from: number, to: number): Promise<RegisterPerformance[]> {
    return this.computeByRegister(await this.fetchPaidOrders(from, to));
  }

  /** Export orders as CSV string for a date range */
  async exportOrdersCsv(from: number, to: number): Promise<string> {
    if (instoreApiConfig.isClient) {
      return instoreApiClient.getOrdersCsv(from, to);
    }

    const orders = await getOrderRepository().findByDateRange(from, to);

    const header = [
      'Order ID',
      'Date',
      'Status',
      'Subtotal',
      'Tax',
      'Discount',
      'Total',
      'Payment Method',
      'Cashier',
      'Sync Status',
      'Register ID',
    ];
    const rows = orders.map(o => [
      o.id,
      new Date(o.created_at).toISOString(),
      o.status,
      o.subtotal.toFixed(2),
      o.tax.toFixed(2),
      (o.discount_amount || 0).toFixed(2),
      o.total.toFixed(2),
      o.payment_method || '',
      o.cashier_name || '',
      o.sync_status,
      o.register_id || '',
    ]);

    return toCsv(header, rows);
  }

  // ── Local aggregation (orders already filtered to paid/synced) ──────────

  private computeSummary(orders: OrderRow[]): SalesSummary {
    const totalSales = toDollars(orders.reduce((sum, o) => sum + toCents(o.total), 0));
    const totalTax = toDollars(orders.reduce((sum, o) => sum + toCents(o.tax), 0));
    const totalDiscount = toDollars(orders.reduce((sum, o) => sum + toCents(o.discount_amount || 0), 0));

    return {
      totalOrders: orders.length,
      totalSales,
      totalTax,
      totalDiscount,
      netSales: subtractMoney(totalSales, totalTax),
      averageOrderValue: orders.length > 0 ? roundMoney(totalSales / orders.length) : 0,
    };
  }

  private computeByHour(orders: OrderRow[]): SalesByPeriod[] {
    const hourBuckets: { count: number; cents: number }[] = Array.from({ length: 24 }, () => ({ count: 0, cents: 0 }));

    for (const order of orders) {
      const bucket = hourBuckets[new Date(order.created_at).getHours()];
      bucket.count++;
      bucket.cents += toCents(order.total);
    }

    return hourBuckets.map((data, hour) => ({
      label: `${hour.toString().padStart(2, '0')}:00`,
      orderCount: data.count,
      totalSales: toDollars(data.cents),
    }));
  }

  private computeByDay(orders: OrderRow[]): SalesByPeriod[] {
    const dayBuckets = new Map<string, { count: number; cents: number }>();

    for (const order of orders) {
      const key = localDayKey(order.created_at);
      const bucket = dayBuckets.get(key) ?? { count: 0, cents: 0 };
      bucket.count++;
      bucket.cents += toCents(order.total);
      dayBuckets.set(key, bucket);
    }

    return Array.from(dayBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, data]) => ({
        label: day,
        orderCount: data.count,
        totalSales: toDollars(data.cents),
      }));
  }

  private computeByCashier(orders: OrderRow[]): CashierPerformance[] {
    const cashierMap = new Map<string, { name: string; count: number; cents: number }>();

    for (const order of orders) {
      const id = order.cashier_id?.trim() || 'unknown';
      const entry = cashierMap.get(id) ?? { name: order.cashier_name?.trim() || 'Unknown', count: 0, cents: 0 };
      entry.count++;
      entry.cents += toCents(order.total);
      cashierMap.set(id, entry);
    }

    return Array.from(cashierMap.entries())
      .map(([cashierId, data]) => ({
        cashierId,
        cashierName: data.name,
        orderCount: data.count,
        totalSales: toDollars(data.cents),
        averageOrderValue: data.count > 0 ? roundMoney(toDollars(data.cents) / data.count) : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }

  private computeByRegister(orders: OrderRow[]): RegisterPerformance[] {
    const registerMap = new Map<string, { count: number; cents: number }>();

    for (const order of orders) {
      const id = order.register_id?.trim() || 'unknown';
      const entry = registerMap.get(id) ?? { count: 0, cents: 0 };
      entry.count++;
      entry.cents += toCents(order.total);
      registerMap.set(id, entry);
    }

    return Array.from(registerMap.entries())
      .map(([registerId, data]) => ({
        registerId,
        orderCount: data.count,
        totalSales: toDollars(data.cents),
      }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }

  /**
   * Split-tender orders carry their real tender mix in payments_json — each
   * line counts toward its own method. Single-tender orders fall back to the
   * primary payment_method at the full order total.
   */
  private computePaymentBreakdown(orders: OrderRow[]): PaymentBreakdown[] {
    const methodMap = new Map<string, { count: number; cents: number }>();
    let grandCents = 0;

    const credit = (method: string, amount: number) => {
      const key = method.trim() || 'unknown';
      const entry = methodMap.get(key) ?? { count: 0, cents: 0 };
      entry.count++;
      entry.cents += toCents(amount);
      methodMap.set(key, entry);
      grandCents += toCents(amount);
    };

    for (const order of orders) {
      const lines = this.parsePaymentLines(order);
      if (lines.length > 0) {
        for (const line of lines) {
          credit(line.method ?? 'unknown', line.amount ?? 0);
        }
      } else {
        credit(order.payment_method ?? 'unknown', order.total);
      }
    }

    return Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        count: data.count,
        total: toDollars(data.cents),
        percentage: grandCents > 0 ? Math.round((data.cents / grandCents) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  private parsePaymentLines(order: OrderRow): PaymentLine[] {
    if (!order.payments_json) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(order.payments_json);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(
        (line): line is PaymentLine => typeof line === 'object' && line !== null && typeof (line as PaymentLine).amount === 'number'
      );
    } catch (error) {
      this.logger.warn('Failed to parse payments_json for report', { orderId: order.id, error });
      return [];
    }
  }
}

export const reportingService = ReportingService.getInstance();
