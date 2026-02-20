import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { ProductQueryOptions, Product, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformSearchServiceInterface, PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';

/**
 * Base abstract class for platform-specific search service implementations
 * Provides common functionality for all platform search services
 */
export abstract class BaseSearchService implements PlatformSearchServiceInterface {
  protected initialized: boolean = false;
  protected config: PlatformSearchConfig;
  protected readonly MAX_HISTORY_ITEMS = 10;
  protected searchHistory: string[] = [];

  /**
   * Creates a new platform search service
   * @param config Platform-specific configuration
   */
  constructor(config: PlatformSearchConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the search service
   * Each platform must implement this to handle platform-specific initialization
   */
  abstract initialize(): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get configuration requirements for this platform
   * Each platform must implement this to specify its required config fields
   */
  abstract getConfigRequirements(): PlatformConfigRequirements;

  /**
   * Search for platform-specific products
   * This is the main method that platform implementations must provide
   */
  abstract searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]>;

  /**
   * Get products from the platform with specific filtering options
   * Each platform must implement this with its specific API calls
   */
  abstract getProducts(options: ProductQueryOptions): Promise<ProductResult>;

  /**
   * Get categories available in this platform's catalog
   * Each platform must implement this with its specific API calls
   */
  abstract getCategories(): Promise<string[]>;

  /**
   * Add a query to search history
   */
  protected addToSearchHistory(query: string): void {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || this.searchHistory.includes(trimmedQuery)) {
      return;
    }

    this.searchHistory.unshift(trimmedQuery);

    // Keep history at max size
    if (this.searchHistory.length > this.MAX_HISTORY_ITEMS) {
      this.searchHistory.pop();
    }
  }

  /**
   * Map query options from search options to product query options
   * Utility method for platform implementations
   */
  protected mapToProductQueryOptions(query: string, options: SearchOptions): ProductQueryOptions {
    return {
      search: query,
      page: options.page,
      limit: options.limit,
      includeOutOfStock: options.inStock === false,
      category: options.categories && options.categories.length > 0 ? options.categories[0] : undefined,
    };
  }

  /**
   * Create authorization headers for API requests
   * Utility method for platform implementations
   */
  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  /**
   * Map a product to the SearchProduct format
   */
  protected mapToSearchProduct(product: Product): SearchProduct {
    // Handle null/undefined values safely
    const variant =
      product.variants && product.variants.length > 0
        ? product.variants[0]
        : { price: 0, inventoryQuantity: 0, sku: undefined, barcode: undefined };

    const image = product.images && product.images.length > 0 ? product.images[0] : { url: undefined };

    return {
      // Use ecom- prefix to ensure uniqueness with local products
      // This is consistent with the pattern used elsewhere in RetailPOS
      id: `ecom-${product.id}`,
      name: product.title || 'Unnamed Product',
      description: product.description,
      price: variant.price || 0,
      imageUrl: image.url,
      category: product.productType,
      source: 'ecommerce',
      inStock: !!variant.inventoryQuantity && variant.inventoryQuantity > 0,
      quantity: variant.inventoryQuantity,
      sku: variant.sku,
      barcode: variant.barcode,
      originalProduct: product,
    };
  }
}
