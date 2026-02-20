import { SyncServiceInterface, SyncOptions, SyncStatus, SyncEntityType, SyncDirection } from '../SyncServiceInterface';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * Offline sync service for local-first POS operation
 * No actual syncing is performed - everything is local-only
 * Returns success for all operations to maintain compatibility
 */
export class OfflineSyncService implements SyncServiceInterface {
  private initialized: boolean = false;
  private logger = LoggerFactory.getInstance().createLogger('OfflineSyncService');

  /**
   * Initialize the offline sync service
   * No actual initialization needed for local-only mode
   */
  async initialize(): Promise<boolean> {
    this.initialized = true;
    this.logger.info('Offline sync service initialized (no-op for local-only mode)');
    return true;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Start a sync operation (no-op for offline mode)
   */
  async startSync(options: SyncOptions): Promise<string> {
    const syncId = `offline-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info(`Offline sync started (no-op): ${syncId}`, { options });

    return syncId;
  }

  /**
   * Get the status of a sync operation
   */
  async getSyncStatus(syncId: string): Promise<SyncStatus> {
    return {
      id: syncId,
      entityType: SyncEntityType.ALL,
      direction: SyncDirection.BIDIRECTIONAL,
      status: 'completed',
      progress: 100,
      total: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      result: {
        entityType: SyncEntityType.ALL,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        warnings: [],
        completedAt: new Date(),
        durationMs: 0,
      },
    };
  }

  /**
   * Cancel an ongoing sync operation (no-op)
   */
  async cancelSync(syncId: string): Promise<boolean> {
    this.logger.info(`Offline sync canceled (no-op): ${syncId}`);
    return true;
  }

  /**
   * Get the history of sync operations (empty for offline mode)
   */
  async getSyncHistory(entityType?: SyncEntityType, limit?: number, offset?: number): Promise<SyncStatus[]> {
    return [];
  }

  /**
   * Schedule a recurring sync operation (no-op)
   */
  async scheduleSync(options: SyncOptions, schedule: string): Promise<string> {
    const scheduleId = `offline-schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.logger.info(`Offline sync scheduled (no-op): ${scheduleId}`, { options, schedule });
    return scheduleId;
  }

  /**
   * Cancel a scheduled sync (no-op)
   */
  async cancelScheduledSync(scheduleId: string): Promise<boolean> {
    this.logger.info(`Offline scheduled sync canceled (no-op): ${scheduleId}`);
    return true;
  }
}

export const offlineSyncService = new OfflineSyncService();
