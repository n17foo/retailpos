import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useOrderHistory } from './useOrderHistory';
import { orderRepository } from '../repositories/OrderRepository';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import { useCheckoutContext } from '../../checkout/contexts/CheckoutProvider';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../repositories/OrderRepository', () => ({
  orderRepository: {
    findByDateRange: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: jest.fn(),
}));

jest.mock('../../checkout/contexts/CheckoutProvider', () => ({
  useCheckoutContext: jest.fn(),
}));

const mockGetLocalOrders = jest.fn();
const mockSyncOrderToPlatform = jest.fn();

async function mountHook() {
  let latest: ReturnType<typeof useOrderHistory> | null = null;
  function Harness() {
    latest = useOrderHistory();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useOrderHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCheckoutContext as jest.Mock).mockReturnValue({
      getLocalOrders: mockGetLocalOrders,
      syncOrderToPlatform: mockSyncOrderToPlatform,
    });
    (orderRepository.findByDateRange as jest.Mock).mockResolvedValue([{ id: 'o1' }]);
    mockGetLocalOrders.mockResolvedValue([{ id: 'o1', createdAt: new Date(1000) }]);
  });

  it('restricts cashier to today and own orders', async () => {
    (useAuthContext as jest.Mock).mockReturnValue({ user: { id: 'cashier-1', role: 'cashier' } });
    const { get } = await mountHook();

    expect(get().isCashier).toBe(true);
    expect(get().orders).toHaveLength(1);
    expect(orderRepository.findByDateRange).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'cashier-1');

    act(() => {
      get().handlePreviousDay();
    });
    expect(get().dayOffset).toBe(0);
  });

  it('allows manager/admin to navigate days and resync orders', async () => {
    (useAuthContext as jest.Mock).mockReturnValue({ user: { id: 'admin-1', role: 'admin' } });
    mockSyncOrderToPlatform.mockResolvedValue({ success: true });
    const { get } = await mountHook();

    expect(get().isAdmin).toBe(true);

    await act(async () => {
      get().handlePreviousDay();
    });
    expect(get().dayOffset).toBe(-1);

    await act(async () => {
      await get().handleResyncOrder('o1');
    });
    expect(mockSyncOrderToPlatform).toHaveBeenCalledWith('o1');
  });
});
