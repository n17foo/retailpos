import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useDailyReport } from './useDailyReport';
import { dailyReportService } from '../../hardware/services/printer/DailyReportService';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ symbol: '£', code: 'GBP' }),
}));

jest.mock('../../hardware/services/printer/DailyReportService', () => ({
  dailyReportService: {
    initialize: jest.fn(),
    getCurrentShift: jest.fn(),
    getShiftHistory: jest.fn(),
    openShift: jest.fn(),
    closeShift: jest.fn(),
    generateDailyReport: jest.fn(),
    formatDailyReportForPrint: jest.fn(),
    formatReceiptForPrint: jest.fn(),
  },
}));

async function mountHook() {
  let latest: ReturnType<typeof useDailyReport> | null = null;
  function Harness() {
    latest = useDailyReport();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useDailyReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (dailyReportService.initialize as jest.Mock).mockResolvedValue(undefined);
    (dailyReportService.getCurrentShift as jest.Mock).mockReturnValue(null);
    (dailyReportService.getShiftHistory as jest.Mock).mockResolvedValue([]);
  });

  it('initializes dailyReportService and loads current shift on mount', async () => {
    const { get } = await mountHook();
    expect(dailyReportService.initialize).toHaveBeenCalledTimes(1);
    expect(get().isLoading).toBe(false);
    expect(get().currentShift).toBeNull();
  });

  it('opens and closes shifts and formats report lines with currency symbol', async () => {
    const shift = { id: 's1', cashierName: 'Alice', cashierId: 'u1', openingCash: 100, openedAt: new Date() };
    (dailyReportService.openShift as jest.Mock).mockResolvedValue(shift);
    (dailyReportService.closeShift as jest.Mock).mockResolvedValue({ ...shift, closingCash: 250 });
    (dailyReportService.formatDailyReportForPrint as jest.Mock).mockReturnValue(['TOTAL: £150.00']);

    const { get } = await mountHook();

    await act(async () => {
      await get().openShift('Alice', 'u1', 100);
    });
    expect(get().currentShift).toEqual(shift);

    await act(async () => {
      await get().closeShift(250);
    });
    expect(get().currentShift).toBeNull();
    expect(dailyReportService.getShiftHistory).toHaveBeenCalled();

    const lines = get().getReportLines({} as never);
    expect(dailyReportService.formatDailyReportForPrint).toHaveBeenCalledWith({}, '£');
    expect(lines).toEqual(['TOTAL: £150.00']);
  });
});
