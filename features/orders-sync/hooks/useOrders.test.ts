import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useOrders } from './useOrders';
import { orderRepository } from '../repositories/OrderRepository';
import { orderItemRepository } from '../repositories/OrderItemRepository';

jest.mock('../repositories/OrderRepository', () => {
  const repo = {
    findAll: jest.fn(),
    delete: jest.fn(),
  };
  return { orderRepository: repo, getOrderRepository: () => repo };
});

jest.mock('../repositories/OrderItemRepository', () => {
  const repo = {
    findByOrderId: jest.fn(),
  };
  return { orderItemRepository: repo, getOrderItemRepository: () => repo };
});

jest.mock('../../multi-register/services/InstoreApiConfig', () => ({
  instoreApiConfig: { isClient: false },
}));

jest.mock('../../multi-register/services/sync/SyncEventBus', () => ({
  syncEventBus: {
    on: jest.fn(() => jest.fn()),
  },
}));

async function mountHook() {
  let latest: ReturnType<typeof useOrders> | null = null;
  function Harness() {
    latest = useOrders();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useOrders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (orderRepository.findAll as jest.Mock).mockResolvedValue([
      {
        id: 'o1',
        subtotal: 10,
        tax: 2,
        total: 12,
        status: 'paid',
        sync_status: 'synced',
        payment_method: 'cash',
        customer_name: null,
        cashier_name: 'Alice',
        sale_mode: 'counter',
        created_at: 1000,
      },
    ]);
    (orderItemRepository.findByOrderId as jest.Mock).mockResolvedValue([
      { id: 'i1', order_id: 'o1', product_id: 'p1', name: 'Tea', price: 10, quantity: 1 },
    ]);
  });

  it('loads orders and their items on mount', async () => {
    const { get } = await mountHook();
    expect(get().isLoading).toBe(false);
    expect(get().orders).toHaveLength(1);
    expect(get().orders[0].id).toBe('o1');
    expect(get().orders[0].items).toHaveLength(1);
  });

  it('deletes an order and refreshes the order list', async () => {
    (orderRepository.delete as jest.Mock).mockResolvedValue(undefined);
    const { get } = await mountHook();

    await act(async () => {
      await get().deleteOrder('o1');
    });

    expect(orderRepository.delete).toHaveBeenCalledWith('o1');
    expect(orderRepository.findAll).toHaveBeenCalledTimes(2);
  });
});
