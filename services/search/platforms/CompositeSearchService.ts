import { SearchServiceInterface, SearchOptions, SearchResult, SearchProduct } from '../SearchServiceInterface';
import { PlatformSearchServiceInterface } from './PlatformSearchServiceInterface';

/**
 * Composite search service that implements the search service interface
 * by delegating to platform-specific implementations
 */
export class CompositeSearchService implements SearchServiceInterface {
  private initialized: boolean = false;
  private searchHistory: string[] = [];
  private readonly MAX_HISTORY_ITEMS = 10;

  /**
   * Create a new composite search service
   * @param platformServices The platform-specific search services to use
   */
  constructor(private platformServices: PlatformSearchServiceInterface[]) {}

  /**
   * Initialize all platform search services
   */
  async initialize(): Promise<boolean> {
    if (this.platformServices.length === 0) {
      console.warn('No platform search services provided');
      return false;
    }

    // Initialize all platform services
    const initResults = await Promise.all(this.platformServices.map(service => service.initialize()));

    // Check if at least one service initialized successfully
    this.initialized = initResults.some(result => result === true);

    return this.initialized;
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Search for products across all initialized platform services
   */
  async searchProducts(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    if (!this.isInitialized()) {
      throw new Error('Search service is not initialized');
    }

    this.addToSearchHistory(query);

    // Get initialized platform services
    const activeServices = this.platformServices.filter(service => service.isInitialized());

    if (activeServices.length === 0) {
      return {
        query,
        totalResults: 0,
        localResults: [],
        ecommerceResults: [],
        categories: [],
      };
    }

    // Search across all active platform services
    const searchPromises = activeServices.map(service => service.searchPlatformProducts(query, options));

    // Wait for all searches to complete
    const allResults = await Promise.all(searchPromises);

    // Flatten all product results
    const ecommerceResults = allResults.flat();

    // Extract unique categories from results
    const allCategories = new Set<string>();
    ecommerceResults.forEach(product => {
      if (product.category) {
        allCategories.add(product.category);
      }
    });

    return {
      query,
      totalResults: ecommerceResults.length,
      localResults: [], // Empty as we're only using e-commerce
      ecommerceResults,
      categories: Array.from(allCategories),
    };
  }

  /**
   * Get search history for the current session
   */
  getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.searchHistory = [];
  }

  /**
   * Add a query to search history
   */
  private addToSearchHistory(query: string): void {
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
   * Get all platform services managed by this composite
   */
  getPlatformServices(): PlatformSearchServiceInterface[] {
    return [...this.platformServices];
  }

  /**
   * Add a platform service to this composite
   */
  addPlatformService(service: PlatformSearchServiceInterface): void {
    if (!this.platformServices.includes(service)) {
      this.platformServices.push(service);

      // If we're already initialized, initialize the new service too
      if (this.initialized) {
        service.initialize().catch(error => {
          console.error('Failed to initialize added platform service:', error);
        });
      }
    }
  }
}
