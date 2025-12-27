import {
  SyncDirection,
  SyncEntityType,
  SyncError,
  SyncOperationResult,
  SyncOptions,
  SyncServiceInterface,
  SyncStatus,
} from './SyncServiceInterface';
import { v4 as uuidv4 } from 'uuid';

/**
 * Base implementation of the sync service that handles common functionality
 */
export abstract class BaseSyncService implements SyncServiceInterface {
  // In-memory store for active sync operations
  private activeSyncs: Map<string, SyncStatus> = new Map();
  // In-memory store for completed sync history
  private syncHistory: SyncStatus[] = [];
  // In-memory store for scheduled syncs
  private scheduledSyncs: Map<string, { options: SyncOptions; schedule: string; active: boolean }> = new Map();

  /**
   * Start a sync operation
   * @param options Options for the sync operation
   * @returns Promise resolving to a sync ID that can be used to track progress
   */
  async startSync(options: SyncOptions): Promise<string> {
    const syncId = uuidv4();
    const now = new Date();

    const syncStatus: SyncStatus = {
      id: syncId,
      entityType: options.entityType,
      direction: options.direction,
      status: 'queued',
      progress: 0,
      total: 0,
      startedAt: now,
    };

    // Store the sync status
    this.activeSyncs.set(syncId, syncStatus);

    // Execute sync operation in the background
    this.executeSyncOperation(syncId, options).catch(error => {
      console.error(`Error in sync operation ${syncId}:`, error);
      const failedStatus = this.activeSyncs.get(syncId);
      if (failedStatus) {
        failedStatus.status = 'failed';
        failedStatus.completedAt = new Date();
        failedStatus.result = {
          entityType: options.entityType,
          successful: 0,
          failed: 0,
          skipped: 0,
          errors: [{ entityId: 'system', message: error.message || 'Unknown error', details: error }],
          warnings: [],
          completedAt: new Date(),
          durationMs: failedStatus.completedAt.getTime() - failedStatus.startedAt.getTime(),
        };
        this.syncHistory.push(failedStatus);
        this.activeSyncs.delete(syncId);
      }
    });

    return syncId;
  }

  /**
   * Get the status of a sync operation
   * @param syncId ID of the sync operation to check
   * @returns Promise resolving to the current status of the sync
   */
  async getSyncStatus(syncId: string): Promise<SyncStatus> {
    // Check active syncs first
    const activeSync = this.activeSyncs.get(syncId);
    if (activeSync) {
      return { ...activeSync };
    }

    // Then check history
    const historicalSync = this.syncHistory.find(sync => sync.id === syncId);
    if (historicalSync) {
      return { ...historicalSync };
    }

    throw new Error(`Sync operation with ID ${syncId} not found`);
  }

  /**
   * Cancel an ongoing sync operation
   * @param syncId ID of the sync operation to cancel
   * @returns Promise resolving to true if canceled, false if already completed
   */
  async cancelSync(syncId: string): Promise<boolean> {
    const activeSync = this.activeSyncs.get(syncId);
    if (!activeSync) {
      return false; // Already completed or not found
    }

    // Mark as failed due to cancellation
    activeSync.status = 'failed';
    activeSync.completedAt = new Date();
    if (!activeSync.result) {
      activeSync.result = {
        entityType: activeSync.entityType,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [{ entityId: 'system', message: 'Sync operation canceled by user' }],
        warnings: [],
        completedAt: new Date(),
        durationMs: activeSync.completedAt.getTime() - activeSync.startedAt.getTime(),
      };
    } else {
      activeSync.result.errors.push({ entityId: 'system', message: 'Sync operation canceled by user' });
    }

    // Move to history and remove from active syncs
    this.syncHistory.push({ ...activeSync });
    this.activeSyncs.delete(syncId);

    // Additional cleanup can be done here in subclasses

    return true;
  }

  /**
   * Get the history of sync operations
   * @param entityType Optional filter by entity type
   * @param limit Maximum number of items to return
   * @param offset Offset for pagination
   * @returns Promise resolving to a list of sync statuses
   */
  async getSyncHistory(entityType?: SyncEntityType, limit: number = 10, offset: number = 0): Promise<SyncStatus[]> {
    let filtered = [...this.syncHistory];

    // Apply entity type filter
    if (entityType) {
      filtered = filtered.filter(sync => sync.entityType === entityType);
    }

    // Sort by start time, most recent first
    filtered.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    // Apply pagination
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Schedule a recurring sync operation
   * @param options Options for the sync operation
   * @param schedule Cron-style schedule string (e.g., "0 0 * * *" for daily at midnight)
   * @returns Promise resolving to a schedule ID
   */
  async scheduleSync(options: SyncOptions, schedule: string): Promise<string> {
    const scheduleId = uuidv4();

    this.scheduledSyncs.set(scheduleId, {
      options,
      schedule,
      active: true,
    });

    // In a real implementation, we would register this with a job scheduler
    // For now, we just store it in memory

    return scheduleId;
  }

  /**
   * Cancel a scheduled sync
   * @param scheduleId ID of the scheduled sync to cancel
   * @returns Promise resolving to true if canceled
   */
  async cancelScheduledSync(scheduleId: string): Promise<boolean> {
    const scheduled = this.scheduledSyncs.get(scheduleId);
    if (!scheduled) {
      return false;
    }

    scheduled.active = false;
    // In a real implementation, we would unregister this from the job scheduler

    return true;
  }

  /**
   * Update the sync status with progress information
   * @param syncId ID of the sync to update
   * @param progress Current progress count
   * @param total Total items to process
   */
  protected updateSyncProgress(syncId: string, progress: number, total: number): void {
    const sync = this.activeSyncs.get(syncId);
    if (sync) {
      sync.progress = progress;
      sync.total = total;
      sync.status = 'in_progress';
    }
  }

  /**
   * Mark a sync operation as completed
   * @param syncId ID of the completed sync
   * @param result Result of the sync operation
   */
  protected completeSyncOperation(syncId: string, result: SyncOperationResult): void {
    const sync = this.activeSyncs.get(syncId);
    if (sync) {
      sync.status = 'completed';
      sync.progress = sync.total;
      sync.completedAt = new Date();
      sync.result = result;

      // Move to history and remove from active syncs
      this.syncHistory.push({ ...sync });
      this.activeSyncs.delete(syncId);

      // Limit history size (optional)
      if (this.syncHistory.length > 100) {
        this.syncHistory.shift(); // Remove oldest item
      }
    }
  }

  /**
   * Execute a sync operation
   * This method should be implemented by subclasses to perform the actual sync operation
   * @param syncId ID of the sync operation
   * @param options Options for the sync operation
   */
  protected abstract executeSyncOperation(syncId: string, options: SyncOptions): Promise<void>;
}
