import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useSyncQueue } from './useSyncQueue';
import { orderRepository } from '../repositories/OrderRepository';
import { db } from '../../../shared/utils/db';

jest.mock('../repositories/OrderRepository', () => {
  const repo = {
    findUnsynced: jest.fn(),
    findAll: jest.fn(),
  };
  return { orderRepository: repo, getOrderRepository: () => repo };
});

jest.mock('../../multi-register/services/InstoreApiConfig', () => ({
  instoreApiConfig: { isClient: false },
}));

jest.mock('../../platform-clients/services/clients/instoreapi/InstoreApiClient', () => ({
  instoreApiClient: { getOrderItems: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../../../shared/utils/db', () => ({
  db: {
    getAllAsync: jest.fn(),
  },
}));

const mockOrderSyncService = {
  retrySingleOrder: jest.fn(),
  syncAllPendingOrders: jest.fn(),
  discardFailedOrder: jest.fn(),
};

jest.mock('../../basket/services/BasketServiceFactory', () => ({
  getServiceContainer: jest.fn(async () => ({
    orderSyncService: mockOrderSyncService,
  })),
}));

async function mountHook() {
  let latest: ReturnType<typeof useSyncQueue> | null = null;
  function Harness() {
    latest = useSyncQueue();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useSyncQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (orderRepository.findUnsynced as jest.Mock).mockResolvedValue([
      {
        id: 'o1',
        total: 20,
        cashier_name: 'Alice',
        sync_status: 'pending',
        sync_error: null,
        status: 'paid',
        created_at: 2000,
        updated_at: 2000,
      },
    ]);
    (orderRepository.findAll as jest.Mock).mockResolvedValue([
      {
        id: 'o2',
        total: 35,
        cashier_name: 'Bob',
        sync_status: 'failed',
        sync_error: '500 Internal Error',
        status: 'paid',
        created_at: 1000,
        updated_at: 1000,
      },
    ]);
    (db.getAllAsync as jest.Mock).mockResolvedValue([
      { order_id: 'o1', total_items: 2 },
      { order_id: 'o2', total_items: 3 },
    ]);
  });

  it('loads pending and failed orders with item counts', async () => {
    const { get } = await mountHook();
    expect(get().isLoading).toBe(false);
    expect(get().totalCount).toBe(2);
    expect(get().failedCount).toBe(1);
    expect(get().orders[0].itemCount).toBe(2);
  });

  it('retries single order, retries all, and discards failed order', async () => {
    mockOrderSyncService.retrySingleOrder.mockResolvedValue({ success: true });
    mockOrderSyncService.syncAllPendingOrders.mockResolvedValue({ synced: 2, failed: 0 });
    mockOrderSyncService.discardFailedOrder.mockResolvedValue(true);

    const { get } = await mountHook();

    await act(async () => {
      expect(await get().retryOrder('o1')).toBe(true);
      expect(await get().retryAll()).toEqual({ synced: 2, failed: 0 });
      expect(await get().discardOrder('o2')).toBe(true);
    });

    expect(mockOrderSyncService.retrySingleOrder).toHaveBeenCalledWith('o1');
    expect(mockOrderSyncService.syncAllPendingOrders).toHaveBeenCalled();
    expect(mockOrderSyncService.discardFailedOrder).toHaveBeenCalledWith('o2');
  });
});
