/**
 * Direction of the sync operation
 */
export enum SyncDirection {
  POS_TO_ECOMMERCE = 'pos_to_ecommerce',
  ECOMMERCE_TO_POS = 'ecommerce_to_pos',
  BIDIRECTIONAL = 'bidirectional',
}

/**
 * Type of entities that can be synced
 */
export enum SyncEntityType {
  PRODUCT = 'product',
  INVENTORY = 'inventory',
  ORDER = 'order',
  CATEGORY = 'category',
  CUSTOMER = 'customer',
  ALL = 'all',
}

/**
 * Options for a sync operation
 */
export interface SyncOptions {
  entityType: SyncEntityType;
  direction: SyncDirection;
  platformIds?: string[];
  entityIds?: string[];
  force?: boolean;
  batchSize?: number;
  skipErrors?: boolean;
  dryRun?: boolean;
}

/**
 * Results of a sync operation
 */
export interface SyncOperationResult {
  entityType: SyncEntityType;
  successful: number;
  failed: number;
  skipped: number;
  errors: SyncError[];
  warnings: string[];
  completedAt: Date;
  durationMs: number;
}

/**
 * Error during a sync operation
 */
export interface SyncError {
  entityId: string;
  platform?: string;
  message: string;
  details?: any;
}

/**
 * Status of an ongoing or completed sync
 */
export interface SyncStatus {
  id: string;
  entityType: SyncEntityType;
  direction: SyncDirection;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  total: number;
  startedAt: Date;
  completedAt?: Date;
  result?: SyncOperationResult;
}

/**
 * Interface for the sync service
 */
export interface SyncServiceInterface {
  /**
   * Start a sync operation
   * @param options Options for the sync operation
   * @returns Promise resolving to a sync ID that can be used to track progress
   */
  startSync(options: SyncOptions): Promise<string>;

  /**
   * Get the status of a sync operation
   * @param syncId ID of the sync operation to check
   * @returns Promise resolving to the current status of the sync
   */
  getSyncStatus(syncId: string): Promise<SyncStatus>;

  /**
   * Cancel an ongoing sync operation
   * @param syncId ID of the sync operation to cancel
   * @returns Promise resolving to true if canceled, false if already completed
   */
  cancelSync(syncId: string): Promise<boolean>;

  /**
   * Get the history of sync operations
   * @param entityType Optional filter by entity type
   * @param limit Maximum number of items to return
   * @param offset Offset for pagination
   * @returns Promise resolving to a list of sync statuses
   */
  getSyncHistory(entityType?: SyncEntityType, limit?: number, offset?: number): Promise<SyncStatus[]>;

  /**
   * Schedule a recurring sync operation
   * @param options Options for the sync operation
   * @param schedule Cron-style schedule string (e.g., "0 0 * * *" for daily at midnight)
   * @returns Promise resolving to a schedule ID
   */
  scheduleSync(options: SyncOptions, schedule: string): Promise<string>;

  /**
   * Cancel a scheduled sync
   * @param scheduleId ID of the scheduled sync to cancel
   * @returns Promise resolving to true if canceled
   */
  cancelScheduledSync(scheduleId: string): Promise<boolean>;
}
