import { SyncServiceInterface } from '../SyncServiceInterface';

/**
 * Configuration requirements for platform sync services
 */
export interface PlatformSyncConfigRequirements {
  required: string[];
  optional: string[];
}

/**
 * Configuration for platform-specific sync services
 * Different platforms will use different properties from this object
 */
export interface PlatformSyncConfig {
  // Common properties
  storeUrl?: string;
  apiVersion?: string;

  // Authentication properties
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  consumerKey?: string;
  consumerSecret?: string;
  username?: string;
  password?: string;

  // Sync-specific properties
  webhookUrl?: string;
  callbackUrl?: string;
  syncInterval?: number;
  batchSize?: number;

  // BigCommerce specific
  storeHash?: string;
  clientId?: string;

  // Any other platform-specific options can be added via indexing
  [key: string]: string | number | boolean | undefined;
}

/**
 * Interface for platform-specific sync service implementations
 */
export interface PlatformSyncServiceInterface extends SyncServiceInterface {
  /**
   * Initialize the platform sync service with required configuration
   * @param config Configuration for the platform
   */
  initialize(config: PlatformSyncConfig): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean;

  /**
   * Get configuration requirements for this platform
   */
  getConfigRequirements(): PlatformSyncConfigRequirements;

  /**
   * Register webhooks for real-time synchronization
   * @param webhookUrl URL to receive webhook events
   * @returns Promise resolving to true if registration was successful
   */
  registerSyncWebhooks(webhookUrl: string): Promise<boolean>;

  /**
   * Unregister previously registered webhooks
   * @returns Promise resolving to true if unregistration was successful
   */
  unregisterSyncWebhooks(): Promise<boolean>;

  /**
   * Test the connection to the platform
   * @returns Promise resolving to true if connection is successful
   */
  testConnection(): Promise<boolean>;
}
