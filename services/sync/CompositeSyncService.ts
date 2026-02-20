import { SyncDirection, SyncEntityType, SyncOperationResult, SyncOptions, SyncServiceInterface, SyncStatus } from './SyncServiceInterface';
import { BaseSyncService } from './BaseSyncService';
import { ECommercePlatform } from '../../utils/platforms';

/**
 * Composite sync service that coordinates sync operations across multiple platforms
 */
export class CompositeSyncService extends BaseSyncService {
  private platformSyncServices: Map<string, SyncServiceInterface> = new Map();

  /**
   * Create a new composite sync service
   * @param services Platform-specific sync services to include
   */
  constructor(private services: SyncServiceInterface[] = []) {
    super();
    // Register services with platform identifiers
    services.forEach((service, index) => {
      this.platformSyncServices.set(`platform_${index}`, service);
    });
  }

  /**
   * Add a platform sync service with a specific platform identifier
   * @param platform Platform identifier
   * @param service Sync service for the platform
   */
  addPlatformService(platform: ECommercePlatform | string, service: SyncServiceInterface): void {
    this.platformSyncServices.set(platform.toString(), service);
    this.services.push(service);
  }

  /**
   * Get a platform sync service by its identifier
   * @param platform Platform identifier
   * @returns The platform sync service or undefined if not found
   */
  getPlatformService(platform: ECommercePlatform | string): SyncServiceInterface | undefined {
    return this.platformSyncServices.get(platform.toString());
  }

  /**
   * Execute the actual sync operation across all relevant platforms
   * @param syncId ID of the sync operation
   * @param options Options for the sync operation
   */
  protected async executeSyncOperation(syncId: string, options: SyncOptions): Promise<void> {
    // Filter services based on platform IDs if specified
    const servicesToUse = options.platformIds
      ? this.services.filter((_, index) => {
          const platformKey = `platform_${index}`;
          return options.platformIds?.some(id => id === platformKey || this.platformSyncServices.has(id));
        })
      : this.services;

    if (servicesToUse.length === 0) {
      throw new Error('No matching platform sync services found for the specified platforms');
    }

    const results: {
      successful: number;
      failed: number;
      skipped: number;
      errors: { entityId: string; platform?: string; message: string; details?: unknown }[];
      warnings: string[];
      platformResults: Map<string, SyncOperationResult>;
    } = {
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      platformResults: new Map(),
    };

    const startTime = new Date();
    let totalItemCount = 0;
    let processedCount = 0;

    // Start individual sync operations on each platform
    const platformSyncPromises = servicesToUse.map(async (service, index) => {
      try {
        // Start the sync on the individual platform
        const platformSyncId = await service.startSync(options);

        // Wait for completion and monitor progress
        return this.monitorPlatformSync(service, platformSyncId, index, results);
      } catch (error) {
        results.failed++;
        results.errors.push({
          entityId: 'system',
          platform: `platform_${index}`,
          message: `Failed to start sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error,
        });
        return null;
      }
    });

    // Regular progress updates
    const progressMonitor = setInterval(() => {
      this.updateSyncProgress(syncId, processedCount, Math.max(totalItemCount, 1));
    }, 1000);

    // Wait for all platform syncs to complete
    const platformResults = await Promise.all(platformSyncPromises);
    clearInterval(progressMonitor);

    // Aggregate results
    platformResults.forEach((result, index) => {
      if (result) {
        totalItemCount += result.total || 0;
        processedCount += result.progress || 0;

        if (result.result) {
          results.successful += result.result.successful || 0;
          results.failed += result.result.failed || 0;
          results.skipped += result.result.skipped || 0;

          // Add platform-specific errors
          if (result.result.errors && result.result.errors.length > 0) {
            result.result.errors.forEach(syncError => {
              results.errors.push({
                ...syncError,
                platform: `platform_${index}`,
              });
            });
          }

          // Add platform-specific warnings
          if (result.result.warnings && result.result.warnings.length > 0) {
            result.result.warnings.forEach((warning: string) => {
              results.warnings.push(`Platform ${index}: ${warning}`);
            });
          }

          // Store platform-specific results
          results.platformResults.set(`platform_${index}`, result.result);
        }
      }
    });

    // Complete the sync operation
    const endTime = new Date();
    const finalResult: SyncOperationResult = {
      entityType: options.entityType,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped,
      errors: results.errors,
      warnings: results.warnings,
      completedAt: endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
    };

    this.completeSyncOperation(syncId, finalResult);
  }

  /**
   * Monitor a platform-specific sync operation
   * @param service Platform sync service
   * @param platformSyncId ID of the platform-specific sync operation
   * @param platformIndex Index of the platform
   * @param results Aggregated results object to update
   * @returns Promise resolving to the final sync status
   */
  private async monitorPlatformSync(
    service: SyncServiceInterface,
    platformSyncId: string,
    platformIndex: number,
    results: {
      successful: number;
      failed: number;
      skipped: number;
      errors: { entityId: string; platform?: string; message: string; details?: unknown }[];
      warnings: string[];
      platformResults: Map<string, SyncOperationResult>;
    }
  ): Promise<SyncStatus> {
    // Initial delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get initial status
    let status = await service.getSyncStatus(platformSyncId);

    // Monitor until complete
    while (status.status === 'queued' || status.status === 'in_progress') {
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get updated status
      try {
        status = await service.getSyncStatus(platformSyncId);
      } catch (error) {
        results.errors.push({
          entityId: 'system',
          platform: `platform_${platformIndex}`,
          message: `Failed to get sync status: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error,
        });
        break;
      }
    }

    return status;
  }
}
