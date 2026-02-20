import { SearchServiceInterface, SearchOptions, SearchResult, SearchProduct } from '../SearchServiceInterface';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { keyValueRepository } from '../../../repositories/KeyValueRepository';
import { ProductServiceFactory } from '../../product/ProductServiceFactory';
import { ECommercePlatform } from '../../../utils/platforms';

const SEARCH_HISTORY_KEY = 'offline_search_history';

/**
 * Offline search service for local-first POS operation
 * Searches through locally stored products only
 */
export class OfflineSearchService implements SearchServiceInterface {
  private initialized: boolean = false;
  private searchHistory: string[] = [];
  private logger = LoggerFactory.getInstance().createLogger('OfflineSearchService');

  /**
   * Initialize the offline search service
   * Loads search history from local storage
   */
  async initialize(): Promise<boolean> {
    try {
      const storedHistory = await keyValueRepository.getItem(SEARCH_HISTORY_KEY);
      if (storedHistory) {
        this.searchHistory = JSON.parse(storedHistory);
        this.logger.info(`Loaded ${this.searchHistory.length} search history items`);
      }

      this.initialized = true;
      this.logger.info('Offline search service initialized (local-only mode)');
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing offline search service' },
        error instanceof Error ? error : new Error(String(error))
      );
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
      const productService = ProductServiceFactory.getInstance().getService(ECommercePlatform.OFFLINE);
      const limit = options?.limit || 50;
      const page = options?.page || 1;

      const localResults = await productService.getProducts({
        search: trimmedQuery,
        category: options?.categories?.[0],
        limit,
        page,
        includeOutOfStock: !options?.inStock,
      });

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

      const categories = [...new Set(localResults.products.map(p => p.productType).filter(Boolean))] as string[];

      return {
        query: trimmedQuery,
        totalResults: localResults.pagination.totalItems,
        localResults: searchProducts,
        ecommerceResults: [],
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
    await keyValueRepository.removeItem(SEARCH_HISTORY_KEY);
    this.logger.info('Cleared search history');
  }

  /**
   * Add search query to history
   */
  private addToSearchHistory(query: string): void {
    const index = this.searchHistory.indexOf(query);
    if (index > -1) {
      this.searchHistory.splice(index, 1);
    }

    this.searchHistory.unshift(query);

    if (this.searchHistory.length > 50) {
      this.searchHistory = this.searchHistory.slice(0, 50);
    }

    keyValueRepository.setItem(SEARCH_HISTORY_KEY, JSON.stringify(this.searchHistory)).catch(err => {
      this.logger.error('Failed to save search history', err);
    });
  }
}

export const offlineSearchService = new OfflineSearchService();
