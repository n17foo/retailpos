import { Category, CategoryServiceInterface } from '../CategoryServiceInterface';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * PrestaShop-specific category service implementation
 * Handles PrestaShop category API interactions
 */
export class PrestaShopCategoryService implements CategoryServiceInterface {
  private initialized: boolean = false;
  private logger = LoggerFactory.getInstance().createLogger('PrestaShopCategoryService');

  /**
   * Get categories from PrestaShop
   * Note: This is a mock implementation. Full implementation would require PrestaShop API integration.
   */
  async getCategories(): Promise<Category[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info('Fetching categories from PrestaShop (mock implementation)');

    // Mock PrestaShop categories for now
    return [
      {
        id: 'prestashop-1',
        name: 'Electronics',
        description: 'Electronic devices and accessories',
        _originalId: '1',
        _platform: 0,
      },
      {
        id: 'prestashop-2',
        name: 'Clothing',
        description: 'Fashion and apparel',
        _originalId: '2',
        _platform: 0,
      },
      {
        id: 'prestashop-3',
        name: 'Home & Garden',
        description: 'Home improvement and garden supplies',
        _originalId: '3',
        _platform: 0,
      },
    ];
  }

  /**
   * Initialize the service (mock implementation)
   */
  private async initialize(): Promise<boolean> {
    this.initialized = true;
    this.logger.info('PrestaShop category service initialized (mock implementation)');
    return true;
  }
}
