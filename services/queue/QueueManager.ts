import NetInfo, { NetInfoSubscription } from '@react-native-community/netinfo';
import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { useSyncStore } from '../../hooks/useSyncStore';
import { LoggerFactory } from '../logger';

class QueueManager {
  private initialized = false;
  private logger = LoggerFactory.getInstance().createLogger('QueueManager');
  private netInfoUnsubscribe: NetInfoSubscription | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;
  private retryIntervalId: ReturnType<typeof setInterval> | null = null;

  initialize() {
    if (this.initialized) return;

    // 1. Trigger when connection returns
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        this.logger.info('Network connection restored, processing sync queue...');
        useSyncStore.getState().processQueue();
      }
    });

    // 2. Trigger on app foreground
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        this.logger.info('App became active, processing sync queue...');
        useSyncStore.getState().processQueue();
      }
    });

    // 3. Exponential backoff retry — check every 30 seconds
    this.retryIntervalId = setInterval(() => {
      const { queue, processQueue } = useSyncStore.getState();
      const now = new Date();

      const hasReadyRequests = queue.some(request => request.nextRetryAt && request.nextRetryAt <= now);

      if (hasReadyRequests) {
        this.logger.debug('Retryable requests found, processing...');
        processQueue();
      }
    }, 30000);

    this.initialized = true;
    this.logger.info('QueueManager initialized');
  }

  /**
   * Clean up all listeners and intervals.
   * Call this when the app is shutting down or the manager is no longer needed.
   */
  dispose() {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (this.retryIntervalId) {
      clearInterval(this.retryIntervalId);
      this.retryIntervalId = null;
    }
    this.initialized = false;
    this.logger.info('QueueManager disposed');
  }

  // Manual trigger for processing queue
  processQueue() {
    useSyncStore.getState().processQueue();
  }

  // Get queue status
  getQueueStatus() {
    const { queue, isProcessing } = useSyncStore.getState();
    return {
      length: queue.length,
      isProcessing,
      pendingRequests: queue.filter(r => !r.nextRetryAt || r.nextRetryAt <= new Date()).length,
      retryingRequests: queue.filter(r => r.nextRetryAt && r.nextRetryAt > new Date()).length,
    };
  }
}

// Export singleton instance
export const queueManager = new QueueManager();
