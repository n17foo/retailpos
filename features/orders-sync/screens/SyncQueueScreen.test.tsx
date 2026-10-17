import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import SyncQueueScreen from './SyncQueueScreen';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

const mockRetryOrder = jest.fn().mockResolvedValue(true);
const mockOrders = [
  {
    id: 'ord-99998888',
    total: 18.5,
    itemCount: 2,
    cashierName: 'Alice',
    syncStatus: 'failed' as const,
    syncError: '502 Bad Gateway',
    status: 'paid',
    createdAt: new Date(1700000000000),
    updatedAt: new Date(1700000000000),
  },
];

jest.mock('../hooks/useSyncQueue', () => ({
  useSyncQueue: () => ({
    orders: mockOrders,
    totalCount: 1,
    failedCount: 1,
    isLoading: false,
    loadError: null,
    isProcessing: false,
    retryOrder: mockRetryOrder,
    retryAll: jest.fn().mockResolvedValue({ synced: 1, failed: 0 }),
    discardOrder: jest.fn().mockResolvedValue(true),
    refresh: jest.fn(),
  }),
}));

describe('SyncQueueScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays failed order with sync error and triggers retryOrder on Retry press', async () => {
    const tree = await renderUi(<SyncQueueScreen />);
    expect(hasText(tree, '#ord-9999')).toBe(true);
    expect(hasText(tree, '502 Bad Gateway')).toBe(true);

    await pressByText(tree, 'Retry');
    expect(mockRetryOrder).toHaveBeenCalledWith('ord-99998888');
  });
});
