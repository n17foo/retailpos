/**
 * Interface for search services
 * Provides methods for searching products across local and ecommerce inventories
 */
export interface SearchServiceInterface {
  /**
   * Initialize the search service
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   * @returns Boolean indicating if the service is ready
   */
  isInitialized(): boolean;

  /**
   * Search for products across all available sources
   * @param query The search query string
   * @param options Additional search options
   * @returns Promise resolving to search results
   */
  searchProducts(query: string, options?: SearchOptions): Promise<SearchResult>;

  /**
   * Get search history for the current session
   * @returns Array of recent searches
   */
  getSearchHistory(): string[];

  /**
   * Clear search history
   */
  clearSearchHistory(): void;
}

/**
 * Options for searching products
 */
export interface SearchOptions {
  limit?: number;
  page?: number;
  categories?: string[];
  includeEcommerce?: boolean;
  includeLocal?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  searchField?: 'name' | 'sku' | 'barcode' | 'all';
}

/**
 * Results from a search query
 */
export interface SearchResult {
  query: string;
  totalResults: number;
  localResults: SearchProduct[];
  ecommerceResults: SearchProduct[];
  categories: string[];
}

/**
 * Represents a product in search results
 */
export interface SearchProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
  source: 'local' | 'ecommerce';
  inStock: boolean;
  quantity?: number;
  sku?: string;
  barcode?: string;
  originalProduct: any; // The original product object from its source
}
