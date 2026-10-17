import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useReporting } from './useReporting';
import { reportingService } from '../services/ReportingService';

jest.mock('../services/ReportingService', () => ({
  reportingService: {
    getSalesSummary: jest.fn(),
    getSalesByDay: jest.fn(),
    getSalesByHour: jest.fn(),
    getCashierPerformance: jest.fn(),
    getPaymentBreakdown: jest.fn(),
    exportOrdersCsv: jest.fn(),
  },
}));

function mountHook() {
  let latest: ReturnType<typeof useReporting> | null = null;
  function Harness() {
    latest = useReporting();
    return null;
  }
  act(() => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useReporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads summary, daily breakdown, cashier performance, and payment breakdown', async () => {
    (reportingService.getSalesSummary as jest.Mock).mockResolvedValue({ totalSales: 100, orderCount: 2 });
    (reportingService.getSalesByDay as jest.Mock).mockResolvedValue([{ period: '2026-10-17', sales: 100, orders: 2 }]);
    (reportingService.getCashierPerformance as jest.Mock).mockResolvedValue([{ cashierId: 'u1', sales: 100 }]);
    (reportingService.getPaymentBreakdown as jest.Mock).mockResolvedValue([{ method: 'cash', total: 100 }]);

    const { get } = mountHook();

    await act(async () => {
      await get().loadReport(1000, 2000);
    });

    expect(get().summary).toEqual({ totalSales: 100, orderCount: 2 });
    expect(get().salesByDay).toHaveLength(1);
    expect(get().cashierPerformance).toHaveLength(1);
    expect(get().paymentBreakdown).toHaveLength(1);
    expect(get().error).toBeNull();
  });

  it('loads hourly report and exports CSV', async () => {
    (reportingService.getSalesSummary as jest.Mock).mockResolvedValue({ totalSales: 50, orderCount: 1 });
    (reportingService.getSalesByHour as jest.Mock).mockResolvedValue([{ period: '09:00', sales: 50, orders: 1 }]);
    (reportingService.getCashierPerformance as jest.Mock).mockResolvedValue([]);
    (reportingService.getPaymentBreakdown as jest.Mock).mockResolvedValue([]);
    (reportingService.exportOrdersCsv as jest.Mock).mockResolvedValue('id,total\n1,50');

    const { get } = mountHook();

    await act(async () => {
      await get().loadHourlyReport(1000, 2000);
    });
    expect(get().salesByHour).toHaveLength(1);

    const csv = await get().exportCsv(1000, 2000);
    expect(csv).toBe('id,total\n1,50');
  });
});
