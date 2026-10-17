import React from 'react';
import { Share } from 'react-native';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import ReportingScreen from './ReportingScreen';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

const mockLoadReport = jest.fn();
const mockLoadHourlyReport = jest.fn();
const mockExportCsv = jest.fn().mockResolvedValue('id,total\n1,100');

jest.mock('../hooks/useReporting', () => ({
  useReporting: () => ({
    summary: {
      totalSales: 320,
      totalOrders: 8,
      averageOrderValue: 40,
      totalTax: 53.33,
      netSales: 266.67,
    },
    salesByHour: [{ label: '10:00', totalSales: 120, orderCount: 3 }],
    salesByDay: [],
    cashierPerformance: [{ cashierId: 'u1', cashierName: 'Alice', orderCount: 8, totalSales: 320, averageOrderValue: 40 }],
    paymentBreakdown: [{ method: 'card', count: 8, total: 320, percentage: 100 }],
    isLoading: false,
    error: null,
    loadReport: mockLoadReport,
    loadHourlyReport: mockLoadHourlyReport,
    exportCsv: mockExportCsv,
  }),
}));

describe('ReportingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sales summary, hourly breakdown, cashier performance, and exports CSV via Share', async () => {
    const tree = await renderUi(<ReportingScreen />);
    expect(hasText(tree, '£320.00')).toBe(true);
    expect(hasText(tree, 'Alice')).toBe(true);

    await pressByText(tree, 'CSV');
    expect(mockExportCsv).toHaveBeenCalled();
    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({ message: 'id,total\n1,100' }));
  });
});
