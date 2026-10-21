import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useReporting } from './useReporting';
import { reportingService } from '../services/ReportingService';

jest.mock('../services/ReportingService', () => ({
  reportingService: {
    getFullReport: jest.fn(),
    exportOrdersCsv: jest.fn(),
  },
}));

const mockReport = {
  summary: { totalSales: 100, totalOrders: 2, totalTax: 8, totalDiscount: 0, netSales: 92, averageOrderValue: 50 },
  salesByHour: [{ label: '09:00', totalSales: 50, orderCount: 1 }],
  salesByDay: [{ label: '2026-10-17', totalSales: 100, orderCount: 2 }],
  cashierPerformance: [{ cashierId: 'u1', cashierName: 'Alice', orderCount: 2, totalSales: 100, averageOrderValue: 50 }],
  paymentBreakdown: [{ method: 'cash', count: 2, total: 100, percentage: 100 }],
  salesByRegister: [{ registerId: 'pos-1', orderCount: 2, totalSales: 100 }],
};

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
    (reportingService.getFullReport as jest.Mock).mockResolvedValue(mockReport);
  });

  it('loads the full report in a single service call', async () => {
    const { get } = mountHook();

    await act(async () => {
      await get().loadReport(1000, 2000);
    });

    expect(reportingService.getFullReport).toHaveBeenCalledWith(1000, 2000);
    expect(reportingService.getFullReport).toHaveBeenCalledTimes(1);
    expect(get().summary).toEqual(mockReport.summary);
    expect(get().salesByDay).toHaveLength(1);
    expect(get().salesByHour).toHaveLength(1);
    expect(get().cashierPerformance).toHaveLength(1);
    expect(get().paymentBreakdown).toHaveLength(1);
    expect(get().salesByRegister).toHaveLength(1);
    expect(get().error).toBeNull();
  });

  it('loads hourly report and exports CSV', async () => {
    (reportingService.exportOrdersCsv as jest.Mock).mockResolvedValue('id,total\n1,50');

    const { get } = mountHook();

    await act(async () => {
      await get().loadHourlyReport(1000, 2000);
    });
    expect(get().salesByHour).toHaveLength(1);

    const csv = await get().exportCsv(1000, 2000);
    expect(csv).toBe('id,total\n1,50');
  });

  it('sets error state when the report fails to load', async () => {
    (reportingService.getFullReport as jest.Mock).mockRejectedValue(new Error('offline'));
    const { get } = mountHook();

    await act(async () => {
      await get().loadReport(1000, 2000);
    });

    expect(get().error).toBe('Failed to load report data.');
    expect(get().isLoading).toBe(false);
  });
});
