import { Category, CategoryServiceInterface } from '../CategoryServiceInterface';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * Sylius-specific category service implementation
 * Handles Sylius category API interactions
 */
export class SyliusCategoryService implements CategoryServiceInterface {
  private initialized: boolean = false;
  private logger = LoggerFactory.getInstance().createLogger('SyliusCategoryService');

  /**
   * Get categories from Sylius
   * Note: This is a mock implementation. Full implementation would require Sylius API integration.
   */
  async getCategories(): Promise<Category[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info('Fetching categories from Sylius (mock implementation)');

    // Mock Sylius categories for now
    return [
      {
        id: 'sylius-1',
        name: 'T-Shirts',
        description: 'Comfortable cotton t-shirts',
        _originalId: '1',
        _platform: 0,
      },
      {
        id: 'sylius-2',
        name: 'Hoodies',
        description: 'Warm and cozy hoodies',
        _originalId: '2',
        _platform: 0,
      },
      {
        id: 'sylius-3',
        name: 'Accessories',
        description: 'Bags, hats, and other accessories',
        _originalId: '3',
        _platform: 0,
      },
      {
        id: 'sylius-4',
        name: 'Books',
        description: 'Books and publications',
        _originalId: '4',
        _platform: 0,
      },
    ];
  }

  /**
   * Initialize the service (mock implementation)
   */
  private async initialize(): Promise<boolean> {
    this.initialized = true;
    this.logger.info('Sylius category service initialized (mock implementation)');
    return true;
  }
}
