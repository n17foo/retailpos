import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useCustomerSearch } from './useCustomerSearch';
import { customerServiceFactory } from '../services/customer/CustomerServiceFactory';
import { ECommercePlatform } from '../../../shared/utils/platforms';

jest.mock('../services/customer/CustomerServiceFactory', () => ({
  customerServiceFactory: {
    getService: jest.fn(),
  },
}));

const mockSearchCustomers = jest.fn();

function mountHook(platform: ECommercePlatform | undefined = ECommercePlatform.SHOPIFY) {
  let latest: ReturnType<typeof useCustomerSearch> | null = null;
  function Harness() {
    latest = useCustomerSearch(platform, 100);
    return null;
  }
  act(() => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useCustomerSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (customerServiceFactory.getService as jest.Mock).mockReturnValue({
      searchCustomers: mockSearchCustomers,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces search queries and updates customers', async () => {
    mockSearchCustomers.mockResolvedValue({
      customers: [{ id: 'c1', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' }],
      hasMore: true,
      nextCursor: 'cursor-2',
    });

    const { get } = mountHook();
    expect(get().isAvailable).toBe(true);

    act(() => {
      get().search('jane');
    });
    expect(mockSearchCustomers).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(mockSearchCustomers).toHaveBeenCalledWith({ query: 'jane', limit: 10, cursor: undefined });
    expect(get().customers).toHaveLength(1);
    expect(get().hasMore).toBe(true);
  });

  it('appends next page on loadMore and resets on clear', async () => {
    mockSearchCustomers
      .mockResolvedValueOnce({
        customers: [{ id: 'c1', email: 'a@b.com' }],
        hasMore: true,
        nextCursor: 'cur-2',
      })
      .mockResolvedValueOnce({
        customers: [{ id: 'c2', email: 'c@d.com' }],
        hasMore: false,
      });

    const { get } = mountHook();

    act(() => {
      get().search('test');
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    await act(async () => {
      get().loadMore();
    });

    expect(get().customers).toHaveLength(2);
    expect(get().hasMore).toBe(false);

    act(() => {
      get().clear();
    });
    expect(get().customers).toHaveLength(0);
  });
});
