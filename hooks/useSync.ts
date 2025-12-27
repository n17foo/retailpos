import { useState, useCallback } from 'react';
import { SyncServiceFactory } from '../services/sync/syncServiceFactory';
import { SyncOptions, SyncStatus, SyncOperationResult, SyncEntityType, SyncDirection } from '../services/sync/SyncServiceInterface';
import { ECommercePlatform } from '../utils/platforms';

/**
 * Hook for synchronization operations
 * Provides methods for syncing data between local POS and e-commerce platforms
 */
export const useSync = (platform?: ECommercePlatform) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSyncId, setCurrentSyncId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncStatus[]>([]);

  const syncServiceFactory = SyncServiceFactory.getInstance();

  /**
   * Start a sync operation
   */
  const startSync = useCallback(
    async (options: SyncOptions): Promise<string | null> => {
      try {
        setIsSyncing(true);
        setError(null);

        const service = syncServiceFactory.getService(platform);
        const syncId = await service.startSync(options);
        setCurrentSyncId(syncId);
        return syncId;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to start sync';
        setError(errorMessage);
        console.error('Error starting sync:', err);
        return null;
      }
    },
    [syncServiceFactory, platform]
  );

  /**
   * Sync products from e-commerce platform
   */
  const syncProducts = useCallback(
    async (direction: SyncDirection = SyncDirection.ECOMMERCE_TO_POS): Promise<string | null> => {
      return startSync({
        entityType: SyncEntityType.PRODUCT,
        direction,
      });
    },
    [startSync]
  );

  /**
   * Sync orders from e-commerce platform
   */
  const syncOrders = useCallback(
    async (direction: SyncDirection = SyncDirection.ECOMMERCE_TO_POS): Promise<string | null> => {
      return startSync({
        entityType: SyncEntityType.ORDER,
        direction,
      });
    },
    [startSync]
  );

  /**
   * Sync inventory from e-commerce platform
   */
  const syncInventory = useCallback(
    async (direction: SyncDirection = SyncDirection.BIDIRECTIONAL): Promise<string | null> => {
      return startSync({
        entityType: SyncEntityType.INVENTORY,
        direction,
      });
    },
    [startSync]
  );

  /**
   * Perform full sync (all entity types)
   */
  const fullSync = useCallback(
    async (direction: SyncDirection = SyncDirection.BIDIRECTIONAL): Promise<string | null> => {
      return startSync({
        entityType: SyncEntityType.ALL,
        direction,
      });
    },
    [startSync]
  );

  /**
   * Get status of a sync operation
   */
  const getSyncStatus = useCallback(
    async (syncId: string): Promise<SyncStatus | null> => {
      try {
        setIsLoading(true);
        setError(null);

        const service = syncServiceFactory.getService(platform);
        const status = await service.getSyncStatus(syncId);
        setSyncStatus(status);

        // Update isSyncing based on status
        if (status.status === 'completed' || status.status === 'failed') {
          setIsSyncing(false);
        }

        return status;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get sync status';
        setError(errorMessage);
        console.error('Error getting sync status:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [syncServiceFactory, platform]
  );

  /**
   * Cancel ongoing sync operation
   */
  const cancelSync = useCallback(
    async (syncId: string): Promise<boolean> => {
      try {
        const service = syncServiceFactory.getService(platform);
        const canceled = await service.cancelSync(syncId);
        if (canceled) {
          setIsSyncing(false);
          setCurrentSyncId(null);
        }
        return canceled;
      } catch (err) {
        console.error('Error canceling sync:', err);
        return false;
      }
    },
    [syncServiceFactory, platform]
  );

  /**
   * Get sync history
   */
  const getSyncHistory = useCallback(
    async (entityType?: SyncEntityType, limit?: number): Promise<SyncStatus[]> => {
      try {
        setIsLoading(true);
        setError(null);

        const service = syncServiceFactory.getService(platform);
        const history = await service.getSyncHistory(entityType, limit);
        setSyncHistory(history);
        return history;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get sync history';
        setError(errorMessage);
        console.error('Error getting sync history:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [syncServiceFactory, platform]
  );

  /**
   * Schedule a recurring sync
   */
  const scheduleSync = useCallback(
    async (options: SyncOptions, schedule: string): Promise<string | null> => {
      try {
        setError(null);

        const service = syncServiceFactory.getService(platform);
        const scheduleId = await service.scheduleSync(options, schedule);
        return scheduleId;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to schedule sync';
        setError(errorMessage);
        console.error('Error scheduling sync:', err);
        return null;
      }
    },
    [syncServiceFactory, platform]
  );

  /**
   * Cancel a scheduled sync
   */
  const cancelScheduledSync = useCallback(
    async (scheduleId: string): Promise<boolean> => {
      try {
        const service = syncServiceFactory.getService(platform);
        return await service.cancelScheduledSync(scheduleId);
      } catch (err) {
        console.error('Error canceling scheduled sync:', err);
        return false;
      }
    },
    [syncServiceFactory, platform]
  );

  return {
    isLoading,
    isSyncing,
    error,
    currentSyncId,
    syncStatus,
    syncHistory,
    startSync,
    syncProducts,
    syncOrders,
    syncInventory,
    fullSync,
    getSyncStatus,
    cancelSync,
    getSyncHistory,
    scheduleSync,
    cancelScheduledSync,
  };
};
