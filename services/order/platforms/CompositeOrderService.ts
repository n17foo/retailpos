import { Order, OrderServiceInterface } from '../OrderServiceInterface';
import { PlatformOrderServiceInterface } from './PlatformOrderServiceInterface';

/**
 * Composite service that aggregates results from multiple platform-specific order services
 */
export class CompositeOrderService implements OrderServiceInterface {
  private services: PlatformOrderServiceInterface[] = [];

  /**
   * Create a new composite order service
   * @param services Array of platform-specific order services
   */
  constructor(services: PlatformOrderServiceInterface[] = []) {
    this.services = services;
  }

  /**
   * Add a platform service to the composite
   * @param service The platform service to add
   */
  public addService(service: PlatformOrderServiceInterface): void {
    this.services.push(service);
  }

  /**
   * Initialize all platform services
   * @returns Promise resolving to true if at least one service was initialized successfully
   */
  public async initialize(): Promise<boolean> {
    if (this.services.length === 0) {
      return false;
    }

    const results = await Promise.all(
      this.services.map(async service => {
        try {
          return await service.initialize();
        } catch (error) {
          console.error('Failed to initialize order service:', error);
          return false;
        }
      })
    );

    return results.some(result => result === true);
  }

  /**
   * Create a new order in the first available platform
   * @param order Order details to be created
   * @returns Promise resolving to the created order with platform-specific IDs
   */
  public async createOrder(order: Order): Promise<Order> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    // Find first available service
    const service = this.getFirstAvailableService();
    if (!service) {
      throw new Error('No available order service to create order');
    }

    // Create order in the first available service
    return await service.createOrder(order);
  }

  /**
   * Get an existing order by ID from any platform that contains it
   * @param orderId The ID of the order to retrieve
   * @returns Promise resolving to the order if found
   */
  public async getOrder(orderId: string): Promise<Order | null> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    // Try to find the order in any of the services
    for (const service of this.services) {
      if (!service.isInitialized()) {
        continue;
      }

      try {
        const order = await service.getOrder(orderId);
        if (order) {
          return order;
        }
      } catch (error) {
        console.error(`Error getting order ${orderId} from service:`, error);
      }
    }

    return null;
  }

  /**
   * Update an existing order in the platform that contains it
   * @param orderId The ID of the order to update
   * @param updates The order properties to update
   * @returns Promise resolving to the updated order
   */
  public async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    // Find which service the order belongs to
    for (const service of this.services) {
      if (!service.isInitialized()) {
        continue;
      }

      try {
        const order = await service.getOrder(orderId);
        if (order) {
          // This service owns the order
          return await service.updateOrder(orderId, updates);
        }
      } catch (error) {
        console.error(`Error updating order ${orderId} in service:`, error);
      }
    }

    return null;
  }

  /**
   * Get the first available initialized service
   * @returns The first available service or null if none are available
   */
  private getFirstAvailableService(): PlatformOrderServiceInterface | null {
    return this.services.find(service => service.isInitialized()) || null;
  }

  /**
   * Ensure that all services are initialized
   */
  private async ensureInitialized(): Promise<void> {
    await Promise.all(
      this.services.map(async service => {
        if (!service.isInitialized()) {
          try {
            await service.initialize();
          } catch (error) {
            console.error('Failed to initialize service:', error);
          }
        }
      })
    );
  }
}
