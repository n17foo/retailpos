import { SearchOptions, SearchProduct } from '../searchServiceInterface';
import { ProductResult } from '../../product/ProductServiceInterface';
import { ProductQueryOptions } from '../../product/ProductServiceInterface';

/**
 * Interface for platform-specific search services
 * Each e-commerce platform implementation should implement this interface
 */
export interface PlatformSearchServiceInterface {
  /**
   * Initialize the search service for a specific platform
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   * @returns Boolean indicating if the service is ready
   */
  isInitialized(): boolean;

  /**
   * Search for products in the specific e-commerce platform
   * @param query The search query string
   * @param options Additional search options
   * @returns Promise resolving to array of search products
   */
  searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]>;

  /**
   * Get products from the platform with specific filtering options
   * This is the direct implementation that was previously in the e-commerce service
   * @param options Query options for filtering products
   * @returns Promise resolving to product results with pagination
   */
  getProducts(options: ProductQueryOptions): Promise<ProductResult>;

  /**
   * Get categories available in this platform's catalog
   * @returns Promise resolving to array of category names
   */
  getCategories(): Promise<string[]>;

  /**
   * Get configuration requirements for this platform
   * @returns Object describing required and optional configuration fields
   */
  getConfigRequirements(): PlatformConfigRequirements;
}

/**
 * Configuration requirements for a platform search service
 */
export interface PlatformConfigRequirements {
  required: string[];
  optional: string[];
  description: string;
}

/**
 * Base configuration for platform search services
 */
export interface PlatformSearchConfig {
  apiKey?: string;
  apiUrl?: string;
  storeUrl?: string;
  [key: string]: any; // Allow additional platform-specific fields
}
