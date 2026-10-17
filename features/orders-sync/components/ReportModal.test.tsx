import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ReportModal } from './ReportModal';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

describe('ReportModal', () => {
  it('renders shift report summary, payment breakdown, and triggers Print Report', async () => {
    const onPrint = jest.fn();
    const onClose = jest.fn();
    const report = {
      date: new Date(1700000000000),
      shift: {
        id: 's1',
        cashierName: 'Alice',
        cashierId: 'u1',
        startTime: 1700000000000,
        endTime: 1700028800000,
        openingCash: 100,
        closingCash: 250,
      },
      summary: {
        totalOrders: 5,
        itemsSold: 12,
        totalSales: 150,
        totalTax: 25,
        totalDiscount: 0,
        netSales: 125,
        averageOrderValue: 30,
        refunds: 0,
        refundAmount: 0,
        paymentBreakdown: {
          cash: { count: 3, total: 90 },
          card: { count: 2, total: 60 },
        },
      },
    };

    const tree = await renderUi(<ReportModal visible report={report as never} onPrint={onPrint} onClose={onClose} />);
    expect(hasText(tree, 'Shift Report')).toBe(true);
    expect(hasText(tree, '£125.00')).toBe(true);

    await pressByText(tree, 'Print Report');
    expect(onPrint).toHaveBeenCalledTimes(1);
  });
});
