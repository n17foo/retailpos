import { BaseSyncService } from '../BaseSyncService';
import { SyncDirection, SyncEntityType, SyncOperationResult, SyncOptions, SyncStatus } from '../SyncServiceInterface';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock implementation of the sync service for testing and development
 */
export class MockSyncService extends BaseSyncService {
  // Configurable options for simulating sync behavior
  private mockDelay: number = 1000;
  private mockFailureRate: number = 0;
  private mockEntityCounts: Record<SyncEntityType, number> = {
    [SyncEntityType.PRODUCT]: 100,
    [SyncEntityType.INVENTORY]: 50,
    [SyncEntityType.ORDER]: 25,
    [SyncEntityType.CATEGORY]: 10,
    [SyncEntityType.CUSTOMER]: 30,
    [SyncEntityType.ALL]: 215,
  };

  /**
   * Configure mock service behavior
   * @param options Mock configuration options
   */
  configure(options: { delay?: number; failureRate?: number; entityCounts?: Partial<Record<SyncEntityType, number>> }): void {
    if (options.delay !== undefined) {
      this.mockDelay = options.delay;
    }

    if (options.failureRate !== undefined) {
      this.mockFailureRate = Math.max(0, Math.min(1, options.failureRate));
    }

    if (options.entityCounts) {
      this.mockEntityCounts = { ...this.mockEntityCounts, ...options.entityCounts };
    }
  }

  /**
   * Execute a mock sync operation that simulates real behavior
   * @param syncId ID of the sync operation
   * @param options Options for the sync operation
   */
  protected async executeSyncOperation(syncId: string, options: SyncOptions): Promise<void> {
    // Determine number of entities to process based on entity type
    const entityCount =
      options.entityType === SyncEntityType.ALL
        ? this.mockEntityCounts[SyncEntityType.ALL]
        : this.mockEntityCounts[options.entityType] || 10;

    // Simulate processing delay - faster for dry runs
    const processingTime = options.dryRun ? this.mockDelay / 2 : this.mockDelay;
    const processingDelay = processingTime / entityCount;

    // Track results
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    const errors: { entityId: string; message: string }[] = [];
    const warnings: string[] = [];

    // Perform mock sync with simulated progress
    for (let i = 0; i < entityCount; i++) {
      // Simulate random failure based on failure rate
      const willFail = Math.random() < this.mockFailureRate;
      const entityId = `mock-entity-${i}`;

      // Simulate skip if specified in options
      if (options.entityIds && !options.entityIds.includes(entityId)) {
        skipped++;
        continue;
      }

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, processingDelay));

      // Update progress
      this.updateSyncProgress(syncId, i + 1, entityCount);

      // Simulate success or failure
      if (willFail) {
        failed++;
        errors.push({
          entityId,
          message: `Mock sync error for entity ${entityId}`,
        });
      } else {
        successful++;
      }

      // Occasionally add a warning
      if (Math.random() < 0.1) {
        warnings.push(`Mock warning for entity ${entityId}`);
      }
    }

    // Force fail if needed for testing
    if (options.force && options.force === true && options.entityIds?.includes('fail')) {
      throw new Error('Forced sync failure for testing');
    }

    // Complete the operation with results
    const result: SyncOperationResult = {
      entityType: options.entityType,
      successful,
      failed,
      skipped,
      errors,
      warnings,
      completedAt: new Date(),
      durationMs: processingTime,
    };

    this.completeSyncOperation(syncId, result);
  }
}
