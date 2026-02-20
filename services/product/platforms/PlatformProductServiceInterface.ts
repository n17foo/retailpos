import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';

/**
 * Configuration requirements for platform product services
 */
export interface PlatformConfigRequirements {
  required: string[];
  optional: string[];
  description: string;
}

/**
 * Configuration for platform-specific product services
 * Different platforms will use different properties from this object
 */
export interface PlatformProductConfig {
  // Common properties
  storeUrl?: string;
  apiVersion?: string;

  // Authentication properties
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  consumerKey?: string;
  consumerSecret?: string;
  username?: string;
  password?: string;

  // Other configuration options
  webhookUrl?: string;
  defaultLanguage?: string;
  cacheTimeout?: number;

  // Mock configuration options
  mockDelay?: number;
  mockFailure?: boolean;

  // Any other platform-specific options can be added via indexing
  [key: string]: string | number | boolean | undefined;
}

/**
 * Interface for platform-specific product service implementations
 */
export interface PlatformProductServiceInterface {
  /**
   * Initialize the platform product service with required configuration
   */
  initialize(): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean;

  /**
   * Get configuration requirements for this platform
   */
  getConfigRequirements(): PlatformConfigRequirements;

  /**
   * Get products from the platform with specific filtering options
   * @param options Options to filter the products
   * @returns Promise resolving to a list of products and pagination info
   */
  getProducts(options: ProductQueryOptions): Promise<ProductResult>;

  /**
   * Get a single product by ID
   * @param productId ID of the product to retrieve
   * @returns Promise resolving to a product or null if not found
   */
  getProductById(productId: string): Promise<Product | null>;

  /**
   * Create a new product
   * @param product Product data to create
   * @returns Promise resolving to the created product
   */
  createProduct(product: Product): Promise<Product>;

  /**
   * Update an existing product
   * @param productId ID of the product to update
   * @param productData Updated product data
   * @returns Promise resolving to the updated product
   */
  updateProduct(productId: string, productData: Partial<Product>): Promise<Product>;

  /**
   * Delete a product
   * @param productId ID of the product to delete
   * @returns Promise resolving to a boolean indicating success
   */
  deleteProduct(productId: string): Promise<boolean>;

  /**
   * Sync products between platforms or systems
   * @param products Products to sync
   * @returns Promise resolving to a sync result
   */
  syncProducts(products: Product[]): Promise<SyncResult>;
}
