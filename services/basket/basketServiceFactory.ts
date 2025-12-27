import { BasketService } from './BasketService';
import { BasketServiceInterface } from './BasketServiceInterface';

/**
 * Factory for creating and managing the basket service instance
 * Implements the singleton pattern
 */
export class BasketServiceFactory {
  private static instance: BasketServiceFactory;
  private basketService: BasketService | null = null;
  private initialized: boolean = false;

  private constructor() {}

  /**
   * Get the singleton factory instance
   */
  public static getInstance(): BasketServiceFactory {
    if (!BasketServiceFactory.instance) {
      BasketServiceFactory.instance = new BasketServiceFactory();
    }
    return BasketServiceFactory.instance;
  }

  /**
   * Get the basket service instance
   * Creates and initializes the service if it doesn't exist
   */
  public async getService(): Promise<BasketServiceInterface> {
    if (!this.basketService) {
      this.basketService = new BasketService();
    }

    if (!this.initialized) {
      await this.basketService.initialize();
      this.initialized = true;
    }

    return this.basketService;
  }

  /**
   * Get the basket service synchronously
   * Note: This assumes the service has already been initialized
   * Use getService() for guaranteed initialization
   */
  public getServiceSync(): BasketServiceInterface {
    if (!this.basketService) {
      this.basketService = new BasketService();
    }
    return this.basketService;
  }

  /**
   * Reset the basket service (useful for testing)
   */
  public reset(): void {
    this.basketService = null;
    this.initialized = false;
  }
}

/**
 * Convenience function to get the basket service
 */
export async function getBasketService(): Promise<BasketServiceInterface> {
  return BasketServiceFactory.getInstance().getService();
}

/**
 * Convenience function to get the basket service synchronously
 * Note: Assumes the service has already been initialized
 */
export function getBasketServiceSync(): BasketServiceInterface {
  return BasketServiceFactory.getInstance().getServiceSync();
}
