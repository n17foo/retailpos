import { useState, useEffect, useCallback } from 'react';
import { orderRepository } from '../repositories/OrderRepository';
import { orderItemRepository } from '../repositories/OrderItemRepository';
import { rowToOrder, OrderWithItems } from '../utils/orderRow.utils';
import { syncEventBus } from '../../multi-register/services/sync/SyncEventBus';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';

export type { OrderWithItems };

export const useOrders = () => {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await orderRepository.findAll();
      const result: OrderWithItems[] = [];

      for (const row of rows) {
        const items = await orderItemRepository.findByOrderId(row.id);
        result.push(rowToOrder(row, items));
      }

      setOrders(result);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Subscribe to sync events for real-time updates (spec: multi-register.md §2.7.1-2.7.5)
  useEffect(() => {
    if (!instoreApiConfig.isClient) {
      return; // Only client registers need to listen for server events
    }

    // Refresh order list when orders are created, updated, or paid on other registers
    const unsubscribeCreated = syncEventBus.on('order:created', () => {
      fetchOrders();
    });

    const unsubscribeUpdated = syncEventBus.on('order:updated', () => {
      fetchOrders();
    });

    const unsubscribePaid = syncEventBus.on('order:paid', () => {
      fetchOrders();
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribePaid();
    };
  }, [fetchOrders]);

  const deleteOrder = async (id: string) => {
    try {
      // CASCADE delete removes associated order_items automatically
      await orderRepository.delete(id);
      await fetchOrders();
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  return {
    orders,
    isLoading,
    error,
    fetchOrders,
    deleteOrder,
  };
};
