import { keyValueRepository } from '../../repositories/KeyValueRepository';
import { EcommerceSettingsStorage } from '../config/EcommerceSettingsStorage';
import { LocalOrder } from '../basket/BasketServiceInterface';
import { receiptConfigService } from './ReceiptConfigService';
import { addMoney, multiplyMoney, roundMoney, subtractMoney, sumMoney } from '../../utils/money';
import { getCurrencySymbol } from '../../utils/currency';
import { LoggerFactory } from '../logger/LoggerFactory';
import { auditLogService } from '../audit/AuditLogService';

export interface ShiftData {
  id: string;
  startTime: Date;
  endTime: Date | null;
  cashierName: string;
  cashierId: string;
  openingCash: number;
  closingCash: number | null;
  status: 'open' | 'closed';
}

export interface DailyReportData {
  date: Date;
  shift: ShiftData;
  orders: LocalOrder[];
  summary: {
    totalOrders: number;
    totalSales: number;
    totalTax: number;
    totalDiscount: number;
    netSales: number;
    averageOrderValue: number;
    paymentBreakdown: Record<string, { count: number; total: number }>;
    itemsSold: number;
    refunds: number;
    refundAmount: number;
  };
}

const CURRENT_SHIFT_KEY = 'current_shift';
const SHIFT_HISTORY_KEY = 'shift_history';

export class DailyReportService {
  private static instance: DailyReportService;
  private logger = LoggerFactory.getInstance().createLogger('DailyReportService');
  private currentShift: ShiftData | null = null;

  private constructor() {}

  static getInstance(): DailyReportService {
    if (!DailyReportService.instance) {
      DailyReportService.instance = new DailyReportService();
    }
    return DailyReportService.instance;
  }

  async initialize(): Promise<void> {
    try {
      const savedShift = await keyValueRepository.getObject<ShiftData>(CURRENT_SHIFT_KEY);
      if (savedShift && savedShift.status === 'open') {
        this.currentShift = {
          ...savedShift,
          startTime: new Date(savedShift.startTime),
          endTime: savedShift.endTime ? new Date(savedShift.endTime) : null,
        };
      }
    } catch (error) {
      this.logger.error({ message: 'Failed to load current shift:' }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  getCurrentShift(): ShiftData | null {
    return this.currentShift;
  }

  async openShift(cashierName: string, cashierId: string, openingCash: number): Promise<ShiftData> {
    if (this.currentShift && this.currentShift.status === 'open') {
      throw new Error('A shift is already open. Please close it first.');
    }

    const shift: ShiftData = {
      id: `shift-${Date.now()}`,
      startTime: new Date(),
      endTime: null,
      cashierName,
      cashierId,
      openingCash,
      closingCash: null,
      status: 'open',
    };

    this.currentShift = shift;
    await keyValueRepository.setObject(CURRENT_SHIFT_KEY, shift);

    // Log shift opened (spec: audit.md §2.1.9)
    await auditLogService.log('shift:opened', {
      userId: cashierId,
      userName: cashierName,
      details: `Shift opened with starting cash ${openingCash.toFixed(2)}`,
      metadata: {
        shiftId: shift.id,
        openingCash,
      },
    });

    return shift;
  }

  async closeShift(closingCash: number): Promise<ShiftData> {
    if (!this.currentShift || this.currentShift.status !== 'open') {
      throw new Error('No open shift to close.');
    }

    this.currentShift.endTime = new Date();
    this.currentShift.closingCash = closingCash;
    this.currentShift.status = 'closed';

    // Save to history
    const history = (await keyValueRepository.getObject<ShiftData[]>(SHIFT_HISTORY_KEY)) || [];
    history.push(this.currentShift);
    await keyValueRepository.setObject(SHIFT_HISTORY_KEY, history);

    // Log shift closed (spec: audit.md §2.1.10)
    await auditLogService.log('shift:closed', {
      userId: this.currentShift.cashierId,
      userName: this.currentShift.cashierName,
      details: `Shift closed with ending cash ${closingCash.toFixed(2)}`,
      metadata: {
        shiftId: this.currentShift.id,
        openingCash: this.currentShift.openingCash,
        closingCash,
      },
    });

    // Clear current shift
    const closedShift = { ...this.currentShift };
    await keyValueRepository.removeItem(CURRENT_SHIFT_KEY);
    this.currentShift = null;

    return closedShift;
  }

  async generateDailyReport(orders: LocalOrder[], shift?: ShiftData): Promise<DailyReportData> {
    const shiftData = shift || this.currentShift;
    if (!shiftData) {
      throw new Error('No shift data available for report.');
    }

    // Filter orders for this shift by time range and cashier
    const shiftOrders = orders.filter(order => {
      const orderTime = order.createdAt.getTime();
      const shiftStart = new Date(shiftData.startTime).getTime();
      const shiftEnd = shiftData.endTime ? new Date(shiftData.endTime).getTime() : Date.now();
      const inTimeRange = orderTime >= shiftStart && orderTime <= shiftEnd;

      // If the order has a cashierId, match it against the shift's cashierId
      if (order.cashierId && shiftData.cashierId) {
        return inTimeRange && order.cashierId === shiftData.cashierId;
      }

      return inTimeRange;
    });

    // Calculate summary using safe money math
    const paymentBreakdown: Record<string, { count: number; total: number }> = {};
    let itemsSold = 0;
    let refunds = 0;

    for (const order of shiftOrders) {
      itemsSold += order.items.reduce((sum, item) => sum + item.quantity, 0);

      // Use payments array if available (split-tender), otherwise use primary payment method
      if (order.payments && order.payments.length > 0) {
        // Split-tender order - count each payment line separately
        for (const payment of order.payments) {
          const method = payment.method || 'Unknown';
          if (!paymentBreakdown[method]) {
            paymentBreakdown[method] = { count: 0, total: 0 };
          }
          paymentBreakdown[method].count++;
          paymentBreakdown[method].total = addMoney(paymentBreakdown[method].total, payment.amount);
        }
      } else {
        // Single-tender order - use primary payment method
        const paymentMethod = order.paymentMethod || 'Unknown';
        if (!paymentBreakdown[paymentMethod]) {
          paymentBreakdown[paymentMethod] = { count: 0, total: 0 };
        }
        paymentBreakdown[paymentMethod].count++;
        paymentBreakdown[paymentMethod].total = addMoney(paymentBreakdown[paymentMethod].total, order.total);
      }

      if (order.total < 0) {
        refunds++;
      }
    }

    const totalSales = sumMoney(shiftOrders.map(o => o.total));
    const totalTax = sumMoney(shiftOrders.map(o => o.tax || 0));
    const totalDiscount = sumMoney(shiftOrders.map(o => o.discountAmount || 0));
    const refundAmount = sumMoney(shiftOrders.filter(o => o.total < 0).map(o => Math.abs(o.total)));

    return {
      date: new Date(),
      shift: shiftData,
      orders: shiftOrders,
      summary: {
        totalOrders: shiftOrders.length,
        totalSales,
        totalTax,
        totalDiscount,
        netSales: subtractMoney(totalSales, totalTax),
        averageOrderValue: shiftOrders.length > 0 ? roundMoney(totalSales / shiftOrders.length) : 0,
        paymentBreakdown,
        itemsSold,
        refunds,
        refundAmount,
      },
    };
  }

  async getCurrencySymbolFromSettings(): Promise<string> {
    try {
      const settings = await EcommerceSettingsStorage.load<{ offline?: { currency?: string } }>();
      return getCurrencySymbol(settings?.offline?.currency || 'GBP');
    } catch {
      return '£';
    }
  }

  formatDailyReportForPrint(report: DailyReportData, currencySymbol: string = '£'): string[] {
    const cs = currencySymbol;
    const config = receiptConfigService.getConfig();
    const lines: string[] = [];
    const divider = receiptConfigService.getDividerLine();
    const doubleDivider = receiptConfigService.getDoubleDividerLine();

    // Header
    lines.push(receiptConfigService.centerText(config.header.businessName));
    if (config.header.addressLine1) {
      lines.push(receiptConfigService.centerText(config.header.addressLine1));
    }
    if (config.header.addressLine2) {
      lines.push(receiptConfigService.centerText(config.header.addressLine2));
    }
    if (config.header.phone) {
      lines.push(receiptConfigService.centerText(`Tel: ${config.header.phone}`));
    }
    lines.push('');
    lines.push(doubleDivider);
    lines.push(receiptConfigService.centerText('DAILY SALES REPORT'));
    lines.push(doubleDivider);
    lines.push('');

    // Shift Info
    lines.push(receiptConfigService.formatLine('Report Date:', report.date.toLocaleDateString()));
    lines.push(receiptConfigService.formatLine('Cashier:', report.shift.cashierName));
    lines.push(receiptConfigService.formatLine('Shift Start:', new Date(report.shift.startTime).toLocaleTimeString()));
    if (report.shift.endTime) {
      lines.push(receiptConfigService.formatLine('Shift End:', new Date(report.shift.endTime).toLocaleTimeString()));
    }
    lines.push('');
    lines.push(divider);

    // Sales Summary
    lines.push(receiptConfigService.centerText('SALES SUMMARY'));
    lines.push(divider);
    lines.push(receiptConfigService.formatLine('Total Orders:', report.summary.totalOrders.toString()));
    lines.push(receiptConfigService.formatLine('Items Sold:', report.summary.itemsSold.toString()));
    lines.push(receiptConfigService.formatLine('Gross Sales:', `${cs}${report.summary.totalSales.toFixed(2)}`));
    lines.push(receiptConfigService.formatLine('Tax Collected:', `${cs}${report.summary.totalTax.toFixed(2)}`));
    lines.push(receiptConfigService.formatLine('Discounts:', `${cs}${report.summary.totalDiscount.toFixed(2)}`));
    lines.push(receiptConfigService.formatLine('Net Sales:', `${cs}${report.summary.netSales.toFixed(2)}`));
    lines.push(receiptConfigService.formatLine('Avg Order Value:', `${cs}${report.summary.averageOrderValue.toFixed(2)}`));
    lines.push('');

    // Payment Breakdown
    lines.push(divider);
    lines.push(receiptConfigService.centerText('PAYMENT BREAKDOWN'));
    lines.push(divider);
    for (const [method, data] of Object.entries(report.summary.paymentBreakdown)) {
      lines.push(receiptConfigService.formatLine(`${method} (${data.count}):`, `${cs}${data.total.toFixed(2)}`));
    }
    lines.push('');

    // Cash Drawer
    if (report.shift.openingCash !== undefined) {
      lines.push(divider);
      lines.push(receiptConfigService.centerText('CASH DRAWER'));
      lines.push(divider);
      lines.push(receiptConfigService.formatLine('Opening Cash:', `${cs}${report.shift.openingCash.toFixed(2)}`));

      const cashPayments = report.summary.paymentBreakdown['Cash']?.total || 0;
      lines.push(receiptConfigService.formatLine('Cash Sales:', `${cs}${cashPayments.toFixed(2)}`));

      const expectedCash = addMoney(report.shift.openingCash, cashPayments);
      lines.push(receiptConfigService.formatLine('Expected Cash:', `${cs}${expectedCash.toFixed(2)}`));

      if (report.shift.closingCash !== null) {
        lines.push(receiptConfigService.formatLine('Actual Cash:', `${cs}${report.shift.closingCash.toFixed(2)}`));
        const difference = subtractMoney(report.shift.closingCash, expectedCash);
        const diffStr = difference >= 0 ? `+${cs}${difference.toFixed(2)}` : `-${cs}${Math.abs(difference).toFixed(2)}`;
        lines.push(receiptConfigService.formatLine('Difference:', diffStr));
      }
      lines.push('');
    }

    // Refunds
    if (report.summary.refunds > 0) {
      lines.push(divider);
      lines.push(receiptConfigService.centerText('REFUNDS'));
      lines.push(divider);
      lines.push(receiptConfigService.formatLine('Total Refunds:', report.summary.refunds.toString()));
      lines.push(receiptConfigService.formatLine('Refund Amount:', `${cs}${report.summary.refundAmount.toFixed(2)}`));
      lines.push('');
    }

    // Footer
    lines.push(doubleDivider);
    lines.push(receiptConfigService.centerText('*** END OF REPORT ***'));
    lines.push('');
    lines.push(receiptConfigService.centerText(`Printed: ${new Date().toLocaleString()}`));
    lines.push('');
    lines.push('');
    lines.push('');

    return lines;
  }

  formatReceiptForPrint(order: LocalOrder, currencySymbol: string = '£'): string[] {
    const cs = currencySymbol;
    const config = receiptConfigService.getConfig();
    const lines: string[] = [];
    const divider = receiptConfigService.getDividerLine();
    const doubleDivider = receiptConfigService.getDoubleDividerLine();

    // Header
    lines.push(receiptConfigService.centerText(config.header.businessName));
    if (config.header.addressLine1) {
      lines.push(receiptConfigService.centerText(config.header.addressLine1));
    }
    if (config.header.addressLine2) {
      lines.push(receiptConfigService.centerText(config.header.addressLine2));
    }
    if (config.header.phone) {
      lines.push(receiptConfigService.centerText(`Tel: ${config.header.phone}`));
    }
    if (config.header.taxId) {
      lines.push(receiptConfigService.centerText(`Tax ID: ${config.header.taxId}`));
    }
    lines.push('');
    lines.push(divider);

    // Order Info
    lines.push(receiptConfigService.formatLine('Order #:', order.id.slice(-8)));
    lines.push(receiptConfigService.formatLine('Date:', order.createdAt.toLocaleDateString()));
    lines.push(receiptConfigService.formatLine('Time:', order.createdAt.toLocaleTimeString()));
    if (order.customerName) {
      lines.push(receiptConfigService.formatLine('Customer:', order.customerName));
    }
    lines.push(divider);

    // Items
    for (const item of order.items) {
      const itemTotal = multiplyMoney(item.price, item.quantity);
      if (item.quantity > 1) {
        lines.push(item.name);
        lines.push(receiptConfigService.formatLine(`  ${item.quantity} x ${cs}${item.price.toFixed(2)}`, `${cs}${itemTotal.toFixed(2)}`));
      } else {
        lines.push(receiptConfigService.formatLine(item.name, `${cs}${itemTotal.toFixed(2)}`));
      }
    }
    lines.push(divider);

    // Totals
    const subtotal = subtractMoney(order.total, order.tax || 0);
    lines.push(receiptConfigService.formatLine('Subtotal:', `${cs}${subtotal.toFixed(2)}`));
    if (order.tax) {
      lines.push(receiptConfigService.formatLine('Tax:', `${cs}${order.tax.toFixed(2)}`));
    }
    if (order.discountAmount) {
      lines.push(receiptConfigService.formatLine('Discount:', `-${cs}${order.discountAmount.toFixed(2)}`));
    }
    lines.push(doubleDivider);
    lines.push(receiptConfigService.formatLine('TOTAL:', `${cs}${order.total.toFixed(2)}`));
    lines.push(doubleDivider);

    // Payment
    if (order.payments && order.payments.length > 1) {
      // Split-tender - show all payment lines
      lines.push(receiptConfigService.formatLine('Payment:', `Split (${order.payments.length})`));
      lines.push(divider);
      for (const payment of order.payments) {
        const methodLabel = payment.method.replace('_', ' ');
        const txInfo = payment.transactionId ? ` [${payment.transactionId.slice(-6)}]` : '';
        const cardInfo = payment.cardBrand && payment.last4 ? ` ${payment.cardBrand} ****${payment.last4}` : '';
        lines.push(receiptConfigService.formatLine(`  ${methodLabel}${cardInfo}`, `${cs}${payment.amount.toFixed(2)}${txInfo}`));
      }
    } else {
      // Single payment
      lines.push(receiptConfigService.formatLine('Payment:', order.paymentMethod || 'N/A'));
    }
    lines.push('');

    // Footer
    if (config.footer.line1) {
      lines.push(receiptConfigService.centerText(config.footer.line1));
    }
    if (config.footer.line2) {
      lines.push(receiptConfigService.centerText(config.footer.line2));
    }
    if (config.footer.line3) {
      lines.push(receiptConfigService.centerText(config.footer.line3));
    }
    lines.push('');
    lines.push('');
    lines.push('');

    return lines;
  }

  async getShiftHistory(limit: number = 30): Promise<ShiftData[]> {
    try {
      const history = (await keyValueRepository.getObject<ShiftData[]>(SHIFT_HISTORY_KEY)) || [];
      return history
        .map(s => ({
          ...s,
          startTime: new Date(s.startTime),
          endTime: s.endTime ? new Date(s.endTime) : null,
        }))
        .slice(-limit)
        .reverse();
    } catch (error) {
      this.logger.error({ message: 'Failed to load shift history:' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
}

export const dailyReportService = DailyReportService.getInstance();
