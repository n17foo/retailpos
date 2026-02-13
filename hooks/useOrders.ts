import { useState, useEffect, useCallback } from 'react';
import { orderRepository, OrderRow } from '../repositories/OrderRepository';
import { orderItemRepository, OrderItemRow } from '../repositories/OrderItemRepository';

/** Lightweight order + items type returned by this hook */
export interface OrderWithItems {
  id: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  syncStatus: string;
  paymentMethod: string | null;
  customerName: string | null;
  cashierName: string | null;
  createdAt: Date;
  items: OrderItemRow[];
}

function rowToOrder(row: OrderRow, items: OrderItemRow[]): OrderWithItems {
  return {
    id: row.id,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    status: row.status,
    syncStatus: row.sync_status,
    paymentMethod: row.payment_method,
    customerName: row.customer_name,
    cashierName: row.cashier_name,
    createdAt: new Date(row.created_at),
    items,
  };
}

export const useOrders = () => {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
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
    loading,
    error,
    fetchOrders,
    deleteOrder,
  };
};
