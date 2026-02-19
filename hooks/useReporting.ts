import { useState, useCallback } from 'react';
import {
  reportingService,
  SalesSummary,
  SalesByPeriod,
  CashierPerformance,
  PaymentBreakdown,
} from '../services/reporting/ReportingService';

interface UseReportingResult {
  summary: SalesSummary | null;
  salesByHour: SalesByPeriod[];
  salesByDay: SalesByPeriod[];
  cashierPerformance: CashierPerformance[];
  paymentBreakdown: PaymentBreakdown[];
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (from: number, to: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryData, byDay, cashiers, payments] = await Promise.all([
        reportingService.getSalesSummary(from, to),
        reportingService.getSalesByDay(from, to),
        reportingService.getCashierPerformance(from, to),
        reportingService.getPaymentBreakdown(from, to),
      ]);
      setSummary(summaryData);
      setSalesByDay(byDay);
      setCashierPerformance(cashiers);
      setPaymentBreakdown(payments);
    } catch {
      setError('Failed to load report data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadHourlyReport = useCallback(async (dayStart: number, dayEnd: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryData, byHour, cashiers, payments] = await Promise.all([
        reportingService.getSalesSummary(dayStart, dayEnd),
        reportingService.getSalesByHour(dayStart, dayEnd),
        reportingService.getCashierPerformance(dayStart, dayEnd),
        reportingService.getPaymentBreakdown(dayStart, dayEnd),
      ]);
      setSummary(summaryData);
      setSalesByHour(byHour);
      setCashierPerformance(cashiers);
      setPaymentBreakdown(payments);
    } catch {
      setError('Failed to load report data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exportCsv = useCallback(async (from: number, to: number): Promise<string> => {
    return reportingService.exportOrdersCsv(from, to);
  }, []);

  return {
    summary,
    salesByHour,
    salesByDay,
    cashierPerformance,
    paymentBreakdown,
    isLoading,
    error,
    loadReport,
    loadHourlyReport,
    exportCsv,
  };
}
