import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import {
  PlatformInventoryServiceInterface,
  PlatformConfigRequirements,
  PlatformInventoryConfig,
} from './PlatformInventoryServiceInterface';

/**
 * Abstract base class for platform-specific inventory services
 * Provides common functionality and enforces implementation of platform-specific methods
 */
export abstract class BaseInventoryService implements PlatformInventoryServiceInterface {
  protected initialized = false;
  protected config: PlatformInventoryConfig = {};

  /**
   * Get configuration requirements for this platform
   * Each platform must implement this to specify its required and optional config fields
   */
  abstract getConfigRequirements(): PlatformConfigRequirements;

  /**
   * Initialize the platform service with provided configuration
   * @param config Configuration object with platform-specific keys and values
   */
  async initialize(config: PlatformInventoryConfig): Promise<boolean> {
    // Check that all required config properties are present
    const requirements = this.getConfigRequirements();
    const missingFields = requirements.required.filter(field => !config[field]);

    if (missingFields.length > 0) {
      console.error(`Missing required configuration: ${missingFields.join(', ')}`);
      return false;
    }

    // Store the configuration
    this.config = { ...config };
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
   * Get inventory levels for products
   * Each platform must implement this with its specific API calls
   */
  abstract getInventory(productIds: string[]): Promise<InventoryResult>;

  /**
   * Update inventory levels for products
   * Each platform must implement this with its specific API calls
   */
  abstract updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult>;

  /**
   * Create authorization headers for API requests
   * Should be implemented by each platform that needs custom auth headers
   */
  protected getAuthHeaders(): Record<string, string> {
    return {};
  }
}
