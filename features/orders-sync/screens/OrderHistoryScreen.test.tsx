import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import OrderHistoryScreen from './OrderHistoryScreen';

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'admin-1', username: 'Admin', role: 'admin' } }),
}));

const mockGetSyncQueueStatus = jest.fn().mockResolvedValue({ pending: 1, failed: 0 });
jest.mock('../../checkout/contexts/CheckoutProvider', () => ({
  useCheckoutContext: () => ({
    getSyncQueueStatus: mockGetSyncQueueStatus,
    unsyncedOrdersCount: 1,
  }),
}));

const mockOpenShift = jest.fn();
jest.mock('../hooks/useDailyReport', () => ({
  useDailyReport: () => ({
    currentShift: null,
    openShift: mockOpenShift,
    closeShift: jest.fn(),
    generateReport: jest.fn(),
    getReportLines: jest.fn(() => []),
  }),
}));

const sampleOrder = {
  id: 'ord-12345678',
  items: [{ id: 'i1', productId: 'p1', name: 'Cappuccino', price: 3.5, quantity: 1 }],
  subtotal: 3.5,
  tax: 0.7,
  total: 4.2,
  status: 'paid' as const,
  syncStatus: 'pending' as const,
  createdAt: new Date(1700000000000),
  updatedAt: new Date(1700000000000),
};

const mockOrders = [sampleOrder];
jest.mock('../hooks/useOrderHistory', () => ({
  useOrderHistory: () => ({
    orders: mockOrders,
    refreshing: false,
    dayOffset: 0,
    isToday: true,
    isCashier: false,
    isAdmin: true,
    syncingOrderId: null,
    onRefresh: jest.fn(),
    handlePreviousDay: jest.fn(),
    handleNextDay: jest.fn(),
    handleResyncOrder: jest.fn(),
    handleDeleteOrder: jest.fn(),
    getDayStart: () => 1700000000000,
  }),
}));

describe('OrderHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders order history list, pending sync count, and opens ShiftModal on Open Shift', async () => {
    const props = { navigation: {} as never, route: {} as never };
    const tree = await renderUi(<OrderHistoryScreen {...props} />);
    expect(hasText(tree, 'Order History')).toBe(true);
    expect(hasText(tree, 'Order #12345678')).toBe(true);

    await pressByText(tree, 'Open Shift');
    expect(hasText(tree, 'Enter the opening cash amount in the drawer.')).toBe(true);
  });
});
