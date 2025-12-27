import { BasketServiceFactory } from '../basket/basketServiceFactory';
import { LoggerFactory } from '../logger';
import { SyncResult } from '../basket/BasketServiceInterface';

/**
 * Service for syncing local orders to e-commerce platforms
 * Handles background sync and retry logic
 */
export class LocalOrderSyncService {
  private static instance: LocalOrderSyncService;
  private logger = LoggerFactory.getInstance().createLogger('LocalOrderSyncService');
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;

  private constructor() {}

  public static getInstance(): LocalOrderSyncService {
    if (!LocalOrderSyncService.instance) {
      LocalOrderSyncService.instance = new LocalOrderSyncService();
    }
    return LocalOrderSyncService.instance;
  }

  /**
   * Start automatic background sync at specified interval
   * @param intervalMs Sync interval in milliseconds (default: 5 minutes)
   */
  public startAutoSync(intervalMs: number = 5 * 60 * 1000): void {
    if (this.syncInterval) {
      this.logger.info('Auto sync already running');
      return;
    }

    this.logger.info(`Starting auto sync with interval ${intervalMs}ms`);

    // Run initial sync
    this.syncPendingOrders();

    // Set up interval
    this.syncInterval = setInterval(() => {
      this.syncPendingOrders();
    }, intervalMs);
  }

  /**
   * Stop automatic background sync
   */
  public stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.logger.info('Auto sync stopped');
    }
  }

  /**
   * Manually trigger sync of all pending orders
   */
  public async syncPendingOrders(): Promise<SyncResult> {
    if (this.isSyncing) {
      this.logger.info('Sync already in progress, skipping');
      return { synced: 0, failed: 0, errors: [] };
    }

    this.isSyncing = true;
    this.logger.info('Starting sync of pending orders...');

    try {
      const basketService = await BasketServiceFactory.getInstance().getService();
      const result = await basketService.syncAllPendingOrders();

      if (result.synced > 0 || result.failed > 0) {
        this.logger.info(`Sync completed: ${result.synced} synced, ${result.failed} failed`);
      }

      return result;
    } catch (error) {
      this.logger.error({ message: 'Failed to sync pending orders' }, error as Error);
      return {
        synced: 0,
        failed: 0,
        errors: [{ orderId: 'unknown', error: (error as Error).message }],
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get the count of unsynced orders
   */
  public async getUnsyncedCount(): Promise<number> {
    try {
      const basketService = await BasketServiceFactory.getInstance().getService();
      const unsyncedOrders = await basketService.getUnsyncedOrders();
      return unsyncedOrders.length;
    } catch (error) {
      this.logger.error({ message: 'Failed to get unsynced count' }, error as Error);
      return 0;
    }
  }

  /**
   * Check if auto sync is currently running
   */
  public isAutoSyncRunning(): boolean {
    return this.syncInterval !== null;
  }

  /**
   * Check if a sync operation is currently in progress
   */
  public isSyncInProgress(): boolean {
    return this.isSyncing;
  }
}

/**
 * Convenience function to get the local order sync service
 */
export function getLocalOrderSyncService(): LocalOrderSyncService {
  return LocalOrderSyncService.getInstance();
}
