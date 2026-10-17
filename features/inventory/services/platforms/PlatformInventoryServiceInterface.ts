/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';

/**
 * Configuration requirements for platform inventory services
 */
export interface PlatformConfigRequirements {
  required: string[];
  optional: string[];
}

/**
 * Configuration for platform-specific inventory services
 */
export interface PlatformInventoryConfig {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  storeUrl?: string;
  storeHash?: string;
  apiVersion?: string;
  [key: string]: any;
}

/**
 * Interface for platform-specific inventory services
 */
export interface PlatformInventoryServiceInterface {
  /**
   * Get configuration requirements for this platform
   */
  getConfigRequirements(): PlatformConfigRequirements;

  /**
   * Initialize the platform service with provided configuration
   * @param config Configuration with API keys and endpoints
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(config: PlatformInventoryConfig): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   * @returns Boolean indicating if the service is ready
   */
  isInitialized(): boolean;

  /**
   * Get inventory levels for products from the platform
   * @param productIds Array of product IDs to get inventory for
   * @returns Promise resolving to inventory information
   */
  getInventory(productIds: string[]): Promise<InventoryResult>;

  /**
   * Update inventory levels for products on the platform
   * @param updates Inventory updates to apply
   * @returns Promise resolving to the results of the update
   */
  updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult>;
}
