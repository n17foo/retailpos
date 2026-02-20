import { orderRepository, OrderRow } from '../../repositories/OrderRepository';
import { LoggerFactory } from '../logger/LoggerFactory';

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

export interface TopProduct {
  productId: string;
  name: string;
  quantitySold: number;
  totalRevenue: number;
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

/**
 * Reporting service — queries OrderRepository for analytics data.
 * All queries are local SQLite, no platform API calls.
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

  /** Summary stats for a date range */
  async getSalesSummary(from: number, to: number): Promise<SalesSummary> {
    const orders = await orderRepository.findByDateRange(from, to);
    const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'synced');

    const totalSales = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const totalTax = paidOrders.reduce((sum, o) => sum + o.tax, 0);
    const totalDiscount = paidOrders.reduce((sum, o) => sum + (o.discount_amount || 0), 0);

    return {
      totalOrders: paidOrders.length,
      totalSales: Math.round(totalSales * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      netSales: Math.round((totalSales - totalTax) * 100) / 100,
      averageOrderValue: paidOrders.length > 0 ? Math.round((totalSales / paidOrders.length) * 100) / 100 : 0,
    };
  }

  /** Sales grouped by hour for a single day */
  async getSalesByHour(dayStart: number, dayEnd: number): Promise<SalesByPeriod[]> {
    const orders = await orderRepository.findByDateRange(dayStart, dayEnd);
    const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'synced');

    const hourBuckets: Map<number, { count: number; total: number }> = new Map();
    for (let h = 0; h < 24; h++) {
      hourBuckets.set(h, { count: 0, total: 0 });
    }

    for (const order of paidOrders) {
      const hour = new Date(order.created_at).getHours();
      const bucket = hourBuckets.get(hour)!;
      bucket.count++;
      bucket.total += order.total;
    }

    return Array.from(hourBuckets.entries()).map(([hour, data]) => ({
      label: `${hour.toString().padStart(2, '0')}:00`,
      orderCount: data.count,
      totalSales: Math.round(data.total * 100) / 100,
    }));
  }

  /** Sales grouped by day for a date range */
  async getSalesByDay(from: number, to: number): Promise<SalesByPeriod[]> {
    const orders = await orderRepository.findByDateRange(from, to);
    const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'synced');

    const dayBuckets: Map<string, { count: number; total: number }> = new Map();

    for (const order of paidOrders) {
      const date = new Date(order.created_at);
      const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!dayBuckets.has(key)) {
        dayBuckets.set(key, { count: 0, total: 0 });
      }
      const bucket = dayBuckets.get(key)!;
      bucket.count++;
      bucket.total += order.total;
    }

    return Array.from(dayBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, data]) => ({
        label: day,
        orderCount: data.count,
        totalSales: Math.round(data.total * 100) / 100,
      }));
  }

  /** Cashier performance for a date range */
  async getCashierPerformance(from: number, to: number): Promise<CashierPerformance[]> {
    const orders = await orderRepository.findByDateRange(from, to);
    const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'synced');

    const cashierMap: Map<string, { name: string; count: number; total: number }> = new Map();

    for (const order of paidOrders) {
      const id = order.cashier_id || 'unknown';
      if (!cashierMap.has(id)) {
        cashierMap.set(id, { name: order.cashier_name || 'Unknown', count: 0, total: 0 });
      }
      const entry = cashierMap.get(id)!;
      entry.count++;
      entry.total += order.total;
    }

    return Array.from(cashierMap.entries())
      .map(([cashierId, data]) => ({
        cashierId,
        cashierName: data.name,
        orderCount: data.count,
        totalSales: Math.round(data.total * 100) / 100,
        averageOrderValue: data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }

  /** Payment method breakdown for a date range */
  async getPaymentBreakdown(from: number, to: number): Promise<PaymentBreakdown[]> {
    const orders = await orderRepository.findByDateRange(from, to);
    const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'synced');

    const methodMap: Map<string, { count: number; total: number }> = new Map();

    for (const order of paidOrders) {
      const method = order.payment_method || 'unknown';
      if (!methodMap.has(method)) {
        methodMap.set(method, { count: 0, total: 0 });
      }
      const entry = methodMap.get(method)!;
      entry.count++;
      entry.total += order.total;
    }

    const grandTotal = paidOrders.reduce((sum, o) => sum + o.total, 0);

    return Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        count: data.count,
        total: Math.round(data.total * 100) / 100,
        percentage: grandTotal > 0 ? Math.round((data.total / grandTotal) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  /** Export orders as CSV string for a date range */
  async exportOrdersCsv(from: number, to: number): Promise<string> {
    const orders = await orderRepository.findByDateRange(from, to);

    const header = 'Order ID,Date,Status,Subtotal,Tax,Discount,Total,Payment Method,Cashier,Sync Status\n';
    const rows = orders.map(o => {
      const date = new Date(o.created_at).toISOString();
      return [
        o.id,
        date,
        o.status,
        o.subtotal.toFixed(2),
        o.tax.toFixed(2),
        (o.discount_amount || 0).toFixed(2),
        o.total.toFixed(2),
        o.payment_method || '',
        o.cashier_name || '',
        o.sync_status,
      ].join(',');
    });

    return header + rows.join('\n');
  }
}

export const reportingService = ReportingService.getInstance();
