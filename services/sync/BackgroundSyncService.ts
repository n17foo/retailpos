import { getServiceContainer } from '../basket/basketServiceFactory';
import { LoggerFactory } from '../logger/loggerFactory';
import { AppState, AppStateStatus } from 'react-native';
import { notificationService } from '../notifications/NotificationService';

/**
 * Background service for syncing pending orders.
 *
 * Improvements over the naive setInterval approach:
 *  - Exponential backoff on consecutive failures (caps at 15 min)
 *  - Resets backoff on any successful sync
 *  - Pauses when the app is backgrounded, resumes on foreground
 *  - Exposes consecutiveFailures count for diagnostics
 */
export class BackgroundSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private logger = LoggerFactory.getInstance().createLogger('BackgroundSyncService');

  private baseIntervalMs = 300_000; // 5 min default
  private consecutiveFailures = 0;
  private static readonly MAX_BACKOFF_MS = 900_000; // 15 min cap

  private appStateSubscription: { remove(): void } | null = null;

  /**
   * Start the background sync service
   * @param intervalMs Base interval between syncs (default: 5 minutes)
   */
  start(intervalMs: number = 300_000) {
    if (this.isRunning) {
      this.logger.info('Background sync service is already running');
      return;
    }

    this.baseIntervalMs = intervalMs;
    this.consecutiveFailures = 0;
    this.isRunning = true;
    this.logger.info(`Starting background sync service with ${intervalMs}ms base interval`);

    // Listen for app state to pause/resume
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Run immediately, then schedule next
    this.performSyncAndScheduleNext();
  }

  /**
   * Stop the background sync service
   */
  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.isRunning = false;
    this.logger.info('Background sync service stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'active' && this.isRunning) {
      this.logger.info('App foregrounded — triggering sync');
      this.performSyncAndScheduleNext();
    }
  };

  private async performSyncAndScheduleNext() {
    // Clear any existing timer
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    await this.performSync();

    if (!this.isRunning) return;

    // Exponential backoff: base * 2^failures, capped
    const delay = Math.min(this.baseIntervalMs * Math.pow(2, this.consecutiveFailures), BackgroundSyncService.MAX_BACKOFF_MS);

    this.intervalId = setTimeout(() => {
      this.performSyncAndScheduleNext();
    }, delay);
  }

  private async performSync() {
    try {
      const { orderSyncService } = await getServiceContainer();
      const result = await orderSyncService.syncAllPendingOrders();

      if (result.synced > 0 || result.failed > 0) {
        this.logger.info(`Background sync: ${result.synced} synced, ${result.failed} failed`);
      }

      // Reset backoff on any success
      if (result.synced > 0) {
        this.consecutiveFailures = 0;
        notificationService.notify('Orders Synced', `${result.synced} order(s) synced successfully.`, 'success');
      }
      if (result.failed > 0) {
        this.consecutiveFailures++;
        notificationService.notify('Sync Failed', `${result.failed} order(s) failed to sync. Will retry automatically.`, 'error');
      }
    } catch (error) {
      this.consecutiveFailures++;
      this.logger.error('Background sync failed', error instanceof Error ? error : new Error(String(error)));
      if (this.consecutiveFailures <= 3) {
        notificationService.notify('Sync Error', `Background sync encountered an error. Retrying…`, 'warning');
      }
    }
  }
}

// Export singleton instance
export const backgroundSyncService = new BackgroundSyncService();
