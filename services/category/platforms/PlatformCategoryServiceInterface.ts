import { Category } from '../CategoryServiceInterface';

/**
 * Configuration options for platform-specific category services
 */
export interface PlatformCategoryConfig {
  // Common properties
  [key: string]: string | undefined;

  // Shopify specific
  storeUrl?: string;
  accessToken?: string;
  apiVersion?: string;

  // WooCommerce specific
  apiKey?: string;
  apiSecret?: string;

  // BigCommerce specific
  storeHash?: string;
  clientId?: string;
}

/**
 * Defines configuration requirements for platform services
 */
export interface PlatformConfigRequirements {
  required: string[];
  optional: string[];
}

/**
 * Interface for platform-specific category services
 * All e-commerce platform implementations must implement this interface
 */
export interface PlatformCategoryServiceInterface {
  /**
   * Get the configuration requirements for this platform
   */
  getConfigRequirements(): PlatformConfigRequirements;

  /**
   * Initialize the service with platform-specific configuration
   * @param config Configuration options
   */
  initialize(config: PlatformCategoryConfig): Promise<void>;

  /**
   * Check if the service has been properly initialized
   */
  isInitialized(): boolean;

  /**
   * Get all categories from the e-commerce platform
   * @returns Promise resolving to a list of categories
   */
  getCategories(): Promise<Category[]>;

  /**
   * Get a specific category by ID
   * @param categoryId The ID of the category to retrieve
   * @returns Promise resolving to the category or undefined if not found
   */
  getCategoryById(categoryId: string): Promise<Category | undefined>;

  /**
   * Create a new category
   * @param category Category data to create
   * @returns Promise resolving to the created category
   */
  createCategory?(category: Omit<Category, 'id'>): Promise<Category>;

  /**
   * Update an existing category
   * @param categoryId ID of the category to update
   * @param categoryData Updated category data
   * @returns Promise resolving to the updated category
   */
  updateCategory?(categoryId: string, categoryData: Partial<Category>): Promise<Category>;

  /**
   * Delete a category
   * @param categoryId ID of the category to delete
   * @returns Promise resolving to true if successful
   */
  deleteCategory?(categoryId: string): Promise<boolean>;
}
