import { useState, useEffect, useCallback } from 'react';
import { LocalOrder } from '../services/order/order';
import { orderRepository, OrderRow } from '../repositories/OrderRepository';
import { getServiceContainer } from '../services/basket/BasketServiceFactory';

export interface SyncQueueOrder {
  id: string;
  total: number;
  itemCount: number;
  cashierName: string | null;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UseSyncQueueResult {
  /** Orders that are pending or failed sync */
  orders: SyncQueueOrder[];
  /** Total count of unsynced orders */
  totalCount: number;
  /** Number of failed orders */
  failedCount: number;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether a retry/discard is in progress */
  isProcessing: boolean;
  /** Retry syncing a single order */
  retryOrder: (orderId: string) => Promise<boolean>;
  /** Retry all pending/failed orders */
  retryAll: () => Promise<{ synced: number; failed: number }>;
  /** Discard a failed order (mark as cancelled) */
  discardOrder: (orderId: string) => Promise<boolean>;
  /** Refresh the queue data */
  refresh: () => Promise<void>;
}

function mapRow(row: OrderRow): SyncQueueOrder {
  return {
    id: row.id,
    total: row.total,
    itemCount: 0, // We don't join order_items here for performance
    cashierName: row.cashier_name,
    syncStatus: row.sync_status as SyncQueueOrder['syncStatus'],
    syncError: row.sync_error,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function useSyncQueue(): UseSyncQueueResult {
  const [orders, setOrders] = useState<SyncQueueOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await orderRepository.findUnsynced();
      // Also include failed orders that haven't been cancelled
      const failedRows = await orderRepository.findAll('paid');
      const allRelevant = [...rows];

      // Add failed-sync orders that aren't already in the unsynced list
      for (const row of failedRows) {
        if (row.sync_status === 'failed' && !allRelevant.find(r => r.id === row.id)) {
          allRelevant.push(row);
        }
      }

      // Sort by created_at descending
      allRelevant.sort((a, b) => b.created_at - a.created_at);
      setOrders(allRelevant.map(mapRow));
    } catch {
      // Silently fail — the UI will show empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const totalCount = orders.length;
  const failedCount = orders.filter(o => o.syncStatus === 'failed').length;

  const retryOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      setIsProcessing(true);
      try {
        const { orderSyncService } = await getServiceContainer();
        const result = await orderSyncService.retrySingleOrder(orderId);
        await loadQueue();
        return result.success;
      } catch {
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [loadQueue]
  );

  const retryAll = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    setIsProcessing(true);
    try {
      const { orderSyncService } = await getServiceContainer();
      const result = await orderSyncService.syncAllPendingOrders();
      await loadQueue();
      return { synced: result.synced, failed: result.failed };
    } catch {
      return { synced: 0, failed: 0 };
    } finally {
      setIsProcessing(false);
    }
  }, [loadQueue]);

  const discardOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      setIsProcessing(true);
      try {
        const { orderSyncService } = await getServiceContainer();
        const success = await orderSyncService.discardFailedOrder(orderId);
        await loadQueue();
        return success;
      } catch {
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [loadQueue]
  );

  return {
    orders,
    totalCount,
    failedCount,
    isLoading,
    isProcessing,
    retryOrder,
    retryAll,
    discardOrder,
    refresh: loadQueue,
  };
}
