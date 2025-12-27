import { InventoryResult, InventoryUpdate, InventoryUpdateResult, InventoryServiceInterface } from '../InventoryServiceInterface';
import { PlatformInventoryServiceInterface } from './PlatformInventoryServiceInterface';

/**
 * Composite service that aggregates multiple platform-specific inventory services
 * Allows querying inventory across multiple e-commerce platforms
 */
export class CompositeInventoryService implements InventoryServiceInterface {
  private initialized = false;
  private services: PlatformInventoryServiceInterface[] = [];

  /**
   * Create a new composite inventory service
   * @param services Array of platform-specific inventory services to include
   */
  constructor(services: PlatformInventoryServiceInterface[]) {
    this.services = services;
  }

  /**
   * Ensure all services are initialized
   * @returns Promise resolving when initialization check is complete
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (this.services.length === 0) {
      throw new Error('CompositeInventoryService has no platform services');
    }

    this.initialized = true;
  }

  /**
   * Check if at least one service is initialized
   * @returns Boolean indicating if at least one service is ready
   */
  public isInitialized(): boolean {
    return this.services.some(service => service.isInitialized());
  }

  /**
   * Get inventory levels across all platforms
   * @param productIds Array of product IDs to get inventory for
   * @returns Promise resolving to combined inventory information
   */
  public async getInventory(productIds: string[]): Promise<InventoryResult> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    const results: InventoryResult[] = [];

    // Query each service for inventory data
    for (const service of this.services) {
      if (!service.isInitialized()) {
        continue;
      }

      try {
        const result = await service.getInventory(productIds);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error('Error getting inventory from platform service:', error);
      }
    }

    // Combine results from all services
    const combinedItems = results.flatMap(result => result.items || []);

    return {
      items: combinedItems,
    };
  }

  /**
   * Update inventory levels across all platforms
   * @param updates Inventory updates to apply
   * @returns Promise resolving to combined update results
   */
  public async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    const results: InventoryUpdateResult[] = [];

    // Apply updates to each service
    for (const service of this.services) {
      if (!service.isInitialized()) {
        continue;
      }

      try {
        const result = await service.updateInventory(updates);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error('Error updating inventory in platform service:', error);
      }
    }

    // Combine results
    const combined: InventoryUpdateResult = {
      successful: results.reduce((sum, result) => sum + result.successful, 0),
      failed: results.reduce((sum, result) => sum + result.failed, 0),
      errors: results.flatMap(result => result.errors || []),
    };

    return combined;
  }

  /**
   * Get the first available initialized service
   * @returns The first available service or null if none are available
   */
  private getAvailableService(): PlatformInventoryServiceInterface | null {
    return this.services.find(s => s.isInitialized()) || null;
  }
}
