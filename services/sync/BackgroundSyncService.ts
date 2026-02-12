import { getBasketService } from '../basket/basketServiceFactory';
import { LoggerFactory } from '../logger/loggerFactory';

/**
 * Background service for syncing pending orders
 * This service runs periodically to retry failed order syncs
 */
export class BackgroundSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private logger = LoggerFactory.getInstance().createLogger('BackgroundSyncService');

  /**
   * Start the background sync service
   * @param intervalMs How often to check for pending syncs (default: 5 minutes)
   */
  start(intervalMs: number = 300000) {
    if (this.isRunning) {
      this.logger.info('Background sync service is already running');
      return;
    }

    this.logger.info(`Starting background sync service with ${intervalMs}ms interval`);
    this.isRunning = true;

    // Run immediately on start
    this.performSync();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.performSync();
    }, intervalMs);
  }

  /**
   * Stop the background sync service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.logger.info('Background sync service stopped');
  }

  /**
   * Perform a sync operation for all pending orders
   */
  private async performSync() {
    try {
      const basketService = await getBasketService();
      const result = await basketService.syncAllPendingOrders();

      if (result.synced > 0 || result.failed > 0) {
        this.logger.info(`Background sync: ${result.synced} synced, ${result.failed} failed`);
      }
    } catch (error) {
      this.logger.error('Background sync failed:', error);
    }
  }

  /**
   * Check if the service is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const backgroundSyncService = new BackgroundSyncService();
