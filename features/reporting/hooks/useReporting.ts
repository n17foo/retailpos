import { useState, useCallback } from 'react';
import {
  reportingService,
  SalesSummary,
  SalesByPeriod,
  CashierPerformance,
  PaymentBreakdown,
  RegisterPerformance,
} from '../services/ReportingService';

interface UseReportingResult {
  summary: SalesSummary | null;
  salesByHour: SalesByPeriod[];
  salesByDay: SalesByPeriod[];
  cashierPerformance: CashierPerformance[];
  paymentBreakdown: PaymentBreakdown[];
  salesByRegister: RegisterPerformance[];
  isLoading: boolean;
  error: string | null;
  /** Load all report data for a date range */
  loadReport: (from: number, to: number) => Promise<void>;
  /** Load hourly breakdown for a single day */
  loadHourlyReport: (dayStart: number, dayEnd: number) => Promise<void>;
  /** Export orders as CSV string */
  exportCsv: (from: number, to: number) => Promise<string>;
}

export function useReporting(): UseReportingResult {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [salesByHour, setSalesByHour] = useState<SalesByPeriod[]>([]);
  const [salesByDay, setSalesByDay] = useState<SalesByPeriod[]>([]);
  const [cashierPerformance, setCashierPerformance] = useState<CashierPerformance[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown[]>([]);
  const [salesByRegister, setSalesByRegister] = useState<RegisterPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyReport = useCallback(async (from: number, to: number) => {
    setIsLoading(true);
    setError(null);
    try {
      // One fetch: server-aggregated in client mode, one local query in standalone
      const report = await reportingService.getFullReport(from, to);
      setSummary(report.summary);
      setSalesByHour(report.salesByHour);
      setSalesByDay(report.salesByDay);
      setCashierPerformance(report.cashierPerformance);
      setPaymentBreakdown(report.paymentBreakdown);
      setSalesByRegister(report.salesByRegister);
    } catch {
      setError('Failed to load report data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadReport = useCallback((from: number, to: number) => applyReport(from, to), [applyReport]);

  const loadHourlyReport = useCallback((dayStart: number, dayEnd: number) => applyReport(dayStart, dayEnd), [applyReport]);

  const exportCsv = useCallback(async (from: number, to: number): Promise<string> => {
    return reportingService.exportOrdersCsv(from, to);
  }, []);

  return {
    summary,
    salesByHour,
    salesByDay,
    cashierPerformance,
    paymentBreakdown,
    salesByRegister,
    isLoading,
    error,
    loadReport,
    loadHourlyReport,
    exportCsv,
  };
}
