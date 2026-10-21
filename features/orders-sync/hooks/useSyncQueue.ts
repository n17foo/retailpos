import { useState, useEffect, useCallback } from 'react';
import { getOrderRepository, OrderRow } from '../repositories/OrderRepository';
import { getServiceContainer } from '../../basket/services/BasketServiceFactory';
import { db } from '../../../shared/utils/db';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';
import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';

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
  /** Error message when the queue failed to load (distinct from an empty queue) */
  loadError: string | null;
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

/**
 * Get item counts for multiple orders in a single query.
 * Client registers fetch from the Store API (local order_items is empty).
 */
async function getItemCounts(orderIds: string[]): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();

  if (instoreApiConfig.isClient) {
    const items = await instoreApiClient.getOrderItems(orderIds);
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.order_id, (counts.get(item.order_id) ?? 0) + item.quantity);
    }
    return counts;
  }

  const placeholders = orderIds.map(() => '?').join(',');
  const query = `
    SELECT order_id, SUM(quantity) as total_items
    FROM order_items
    WHERE order_id IN (${placeholders})
    GROUP BY order_id
  `;

  const rows = await db.getAllAsync<{ order_id: string; total_items: number }>(query, orderIds);
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.order_id, row.total_items);
  }
  return counts;
}

function mapRow(row: OrderRow): SyncQueueOrder {
  return {
    id: row.id,
    total: row.total,
    itemCount: 0, // Will be populated by loadQueue
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const orderRepo = getOrderRepository();
      const rows = await orderRepo.findUnsynced();
      // Also include failed orders that haven't been cancelled
      const failedRows = await orderRepo.findAll('paid');
      const allRelevant = [...rows];

      // Add failed-sync orders that aren't already in the unsynced list
      for (const row of failedRows) {
        if (row.sync_status === 'failed' && !allRelevant.find(r => r.id === row.id)) {
          allRelevant.push(row);
        }
      }

      // Sort by created_at descending
      allRelevant.sort((a, b) => b.created_at - a.created_at);

      // Get item counts for all orders in a single query (spec requirement: sync.md §4.1)
      const orderIds = allRelevant.map(r => r.id);
      const itemCounts = await getItemCounts(orderIds);

      setOrders(
        allRelevant.map(row => ({
          ...mapRow(row),
          itemCount: itemCounts.get(row.id) || 0,
        }))
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load sync queue');
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
    loadError,
    isProcessing,
    retryOrder,
    retryAll,
    discardOrder,
    refresh: loadQueue,
  };
}
