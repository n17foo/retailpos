import { SearchServiceInterface, SearchOptions, SearchResult, SearchProduct } from '../searchServiceInterface';
import { LoggerFactory } from '../../logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProductServiceFactory } from '../../product/productServiceFactory';
import { ECommercePlatform } from '../../../utils/platforms';

const SEARCH_HISTORY_KEY = 'custom_search_history';

/**
 * Custom/Local search service for offline-first POS operation
 * Searches through locally stored products only
 */
export class CustomSearchService implements SearchServiceInterface {
  private initialized: boolean = false;
  private searchHistory: string[] = [];
  private logger = LoggerFactory.getInstance().createLogger('CustomSearchService');

  /**
   * Initialize the custom search service
   * Loads search history from local storage
   */
  async initialize(): Promise<boolean> {
    try {
      const storedHistory = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (storedHistory) {
        this.searchHistory = JSON.parse(storedHistory);
        this.logger.info(`Loaded ${this.searchHistory.length} search history items`);
      }

      this.initialized = true;
      this.logger.info('Custom search service initialized (local-only mode)');
      return true;
    } catch (error) {
      this.logger.error({ message: 'Error initializing custom search service' }, error instanceof Error ? error : new Error(String(error)));
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Search for products in local storage
   */
  async searchProducts(query: string, options?: SearchOptions): Promise<SearchResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      this.addToSearchHistory(trimmedQuery);
    }

    try {
      // Get local products service
      const productService = ProductServiceFactory.getInstance().getService(ECommercePlatform.CUSTOM);
      const limit = options?.limit || 50;
      const page = options?.page || 1;

      // Search local products
      const localResults = await productService.getProducts({
        search: trimmedQuery,
        category: options?.categories?.[0], // Use first category if specified
        limit,
        page,
        includeOutOfStock: !options?.inStock,
      });

      // Convert products to search results
      const searchProducts: SearchProduct[] = localResults.products.map(product => ({
        id: product.id,
        name: product.title,
        description: product.description,
        price: product.variants[0]?.price || 0,
        imageUrl: product.images?.[0]?.url,
        category: product.productType,
        source: 'local',
        inStock: (product.variants[0]?.inventoryQuantity || 0) > 0,
        quantity: product.variants[0]?.inventoryQuantity,
        sku: product.variants[0]?.sku,
        barcode: product.variants[0]?.barcode,
        originalProduct: product,
      }));

      // Extract unique categories from results
      const categories = [...new Set(localResults.products.map(p => p.productType).filter(Boolean))] as string[];

      return {
        query: trimmedQuery,
        totalResults: localResults.pagination.totalItems,
        localResults: searchProducts,
        ecommerceResults: [], // No ecommerce results in custom mode
        categories,
      };
    } catch (error) {
      this.logger.error({ message: 'Error searching local products' }, error instanceof Error ? error : new Error(String(error)));
      return {
        query: trimmedQuery,
        totalResults: 0,
        localResults: [],
        ecommerceResults: [],
        categories: [],
      };
    }
  }

  /**
   * Get search history
   */
  getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Clear search history
   */
  async clearSearchHistory(): Promise<void> {
    this.searchHistory = [];
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    this.logger.info('Cleared search history');
  }

  /**
   * Add search query to history
   */
  private addToSearchHistory(query: string): void {
    // Remove if already exists
    const index = this.searchHistory.indexOf(query);
    if (index > -1) {
      this.searchHistory.splice(index, 1);
    }

    // Add to beginning
    this.searchHistory.unshift(query);

    // Keep only last 50 searches
    if (this.searchHistory.length > 50) {
      this.searchHistory = this.searchHistory.slice(0, 50);
    }

    // Save to storage
    AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(this.searchHistory)).catch(err => {
      this.logger.error('Failed to save search history', err);
    });
  }
}

export const customSearchService = new CustomSearchService();
