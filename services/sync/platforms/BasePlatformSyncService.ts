import { BaseSyncService } from '../BaseSyncService';
import { PlatformSyncConfig, PlatformSyncConfigRequirements, PlatformSyncServiceInterface } from './PlatformSyncServiceInterface';

/**
 * Base class for platform-specific sync services
 */
export abstract class BasePlatformSyncService extends BaseSyncService implements PlatformSyncServiceInterface {
  protected initialized: boolean = false;
  protected config: PlatformSyncConfig = {};

  /**
   * Initialize the platform sync service with required configuration
   * @param config Configuration for the platform
   */
  async initialize(config: PlatformSyncConfig): Promise<boolean> {
    // Validate required configuration
    const requirements = this.getConfigRequirements();
    const missingKeys = requirements.required.filter(key => !config[key]);

    if (missingKeys.length > 0) {
      console.error(`Missing required configuration for ${this.constructor.name}: ${missingKeys.join(', ')}`);
      return false;
    }

    // Store configuration
    this.config = { ...config };

    // Additional platform-specific initialization should be done in subclasses

    this.initialized = true;
    return true;
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get configuration requirements for this platform
   * This should be implemented by subclasses
   */
  abstract getConfigRequirements(): PlatformSyncConfigRequirements;

  /**
   * Register webhooks for real-time synchronization
   * @param webhookUrl URL to receive webhook events
   * @returns Promise resolving to true if registration was successful
   */
  async registerSyncWebhooks(webhookUrl: string): Promise<boolean> {
    // Default implementation - should be overridden by subclasses
    console.warn(`${this.constructor.name}.registerSyncWebhooks is not implemented`);
    return false;
  }

  /**
   * Unregister previously registered webhooks
   * @returns Promise resolving to true if unregistration was successful
   */
  async unregisterSyncWebhooks(): Promise<boolean> {
    // Default implementation - should be overridden by subclasses
    console.warn(`${this.constructor.name}.unregisterSyncWebhooks is not implemented`);
    return false;
  }

  /**
   * Test the connection to the platform
   * @returns Promise resolving to true if connection is successful
   */
  async testConnection(): Promise<boolean> {
    // Default implementation - should be overridden by subclasses
    console.warn(`${this.constructor.name}.testConnection is not implemented`);
    return false;
  }

  /**
   * Validate configuration object
   * @param config Configuration to validate
   * @returns True if valid, false otherwise
   */
  protected validateConfig(config: PlatformSyncConfig): boolean {
    if (!config) {
      return false;
    }

    const requirements = this.getConfigRequirements();
    const missingKeys = requirements.required.filter(key => !config[key]);

    return missingKeys.length === 0;
  }
}
