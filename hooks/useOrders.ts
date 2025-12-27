import { useState, useEffect, useCallback } from 'react';
import { Order, OrderRepository } from '../repositories/OrderRepository';
import { OrderItem, OrderItemRepository } from '../repositories/OrderItemRepository';

const orderRepository = new OrderRepository();
const orderItemRepository = new OrderItemRepository();

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export const useOrders = () => {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const allOrders = await orderRepository.findAll();
      const ordersWithItems: OrderWithItems[] = [];

      for (const order of allOrders) {
        const items = await orderItemRepository.findByOrderId(order.id);
        ordersWithItems.push({ ...order, items });
      }

      setOrders(ordersWithItems);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const addOrder = async (orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'>, items: Omit<OrderItem, 'id' | 'order_id'>[]) => {
    try {
      // This should ideally be a transaction, but expo-sqlite's withTransactionAsync makes it tricky to return the new order ID.
      // For now, we'll perform the operations sequentially.
      const newOrderId = await orderRepository.create(orderData);

      for (const item of items) {
        await orderItemRepository.create({ ...item, order_id: newOrderId });
      }

      await fetchOrders(); // Refresh the list
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  const updateOrder = async (id: string, orderData: Partial<Order>) => {
    try {
      await orderRepository.update(id, orderData);
      await fetchOrders(); // Refresh the list
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      // The database is set up with cascading deletes, so this will also remove associated order items.
      await orderRepository.delete(id);
      await fetchOrders(); // Refresh the list
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  return {
    orders,
    loading,
    error,
    fetchOrders,
    addOrder,
    updateOrder,
    deleteOrder,
  };
};
