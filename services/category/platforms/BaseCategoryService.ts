import { Category } from '../CategoryServiceInterface';
import { PlatformCategoryConfig, PlatformCategoryServiceInterface, PlatformConfigRequirements } from './PlatformCategoryServiceInterface';

/**
 * Abstract base class for platform-specific category services
 * Provides common functionality shared by all platform implementations
 */
export abstract class BaseCategoryService implements PlatformCategoryServiceInterface {
  protected config: PlatformCategoryConfig = {};
  protected initialized = false;

  /**
   * Get the configuration requirements for this platform
   * Must be implemented by each platform service
   */
  abstract getConfigRequirements(): PlatformConfigRequirements;

  /**
   * Get all categories from the e-commerce platform
   * Must be implemented by each platform service
   */
  abstract getCategories(): Promise<Category[]>;

  /**
   * Get a specific category by ID
   * Must be implemented by each platform service
   */
  abstract getCategoryById(categoryId: string): Promise<Category | undefined>;

  /**
   * Initialize the service with platform-specific configuration
   * @param config Configuration options
   */
  async initialize(config: PlatformCategoryConfig): Promise<void> {
    this.validateConfig(config);
    this.config = { ...config };
    this.initialized = true;
  }

  /**
   * Check if the service has been properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Validate that the provided configuration has all required fields
   * @param config Configuration to validate
   */
  protected validateConfig(config: PlatformCategoryConfig): void {
    const requirements = this.getConfigRequirements();

    // Check for required fields
    const missingFields = requirements.required.filter(field => !config[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Default implementation of create category
   * Can be overridden by platform services
   */
  async createCategory?(category: Omit<Category, 'id'>): Promise<Category> {
    throw new Error('Create category not implemented for this platform');
  }

  /**
   * Default implementation of update category
   * Can be overridden by platform services
   */
  async updateCategory?(categoryId: string, categoryData: Partial<Category>): Promise<Category> {
    throw new Error('Update category not implemented for this platform');
  }

  /**
   * Default implementation of delete category
   * Can be overridden by platform services
   */
  async deleteCategory?(categoryId: string): Promise<boolean> {
    throw new Error('Delete category not implemented for this platform');
  }
}
