import { SearchServiceFactory } from './searchServiceFactory';
import { SearchServiceInterface, SearchOptions, SearchResult } from './searchServiceInterface';

/**
 * Main search service entry point that uses the factory pattern.
 * This follows the same pattern as payment and refund services in RetailPOS.
 */
export class SearchService {
  private static instance: SearchService | null = null;
  private factory: SearchServiceFactory;
  private searchService: SearchServiceInterface | null = null;

  private constructor() {
    this.factory = SearchServiceFactory.getInstance();
    this.searchService = null;
  }

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * Initialize the search service
   */
  public async initialize(): Promise<boolean> {
    try {
      this.searchService = this.factory.getService();
      return await this.searchService.initialize();
    } catch (error) {
      console.error('Failed to initialize search service:', error);
      return false;
    }
  }

  /**
   * Check if the service is properly initialized
   */
  public isInitialized(): boolean {
    return !!this.searchService && this.searchService.isInitialized();
  }

  /**
   * Search for products using the configured search service
   */
  public async searchProducts(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    if (!this.isInitialized()) {
      await this.initialize();
    }

    if (!this.searchService) {
      throw new Error('Search service is not initialized');
    }

    return this.searchService.searchProducts(query, options);
  }

  /**
   * Get search history for the current session
   */
  public getSearchHistory(): string[] {
    if (!this.searchService) {
      return [];
    }
    return this.searchService.getSearchHistory();
  }

  /**
   * Clear search history
   */
  public clearSearchHistory(): void {
    if (this.searchService) {
      this.searchService.clearSearchHistory();
    }
  }
}
