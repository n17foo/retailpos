import { useState, useCallback, useEffect } from 'react';
import { SearchServiceFactory } from '../services/search/searchServiceFactory';
import { SearchOptions, SearchResult } from '../services/search/searchServiceInterface';

/**
 * Hook to interact with the SearchService
 */
export const useSearch = () => {
  const searchServiceFactory = SearchServiceFactory.getInstance();
  const searchService = searchServiceFactory.getService();

  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    includeLocal: true,
    includeEcommerce: true,
    inStock: false,
    limit: 20,
    searchField: 'all',
  });
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Initialize the search service
  useEffect(() => {
    const initializeSearchService = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const initialized = await searchService.initialize();
        setIsInitialized(initialized);

        if (initialized) {
          // Load search history
          setSearchHistory(searchService.getSearchHistory());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize search service');
        console.error('Error initializing search service:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isInitialized) {
      initializeSearchService();
    }
  }, [searchService, isInitialized]);

  /**
   * Perform search with current options
   */
  const performSearch = useCallback(
    (query: string) => {
      return searchProducts(query, searchOptions);
    },
    [searchOptions]
  );

  /**
   * Set search filter options
   * @param options The search options to apply
   */
  const setSearchFilters = (options: Partial<SearchOptions>) => {
    setSearchOptions(prevOptions => ({
      ...prevOptions,
      ...options,
    }));

    // Re-search with the new filters if we have a query
    if (searchQuery) {
      performSearch(searchQuery);
    }
  };

  /**
   * Set search field (name, sku, barcode, or all)
   * @param field The field to search in
   */
  const setSearchField = (field: 'name' | 'sku' | 'barcode' | 'all') => {
    setSearchOptions(prevOptions => ({
      ...prevOptions,
      searchField: field,
    }));

    // Re-search with the new field if we have a query
    if (searchQuery) {
      performSearch(searchQuery);
    }
  };

  /**
   * Search for products
   */
  const searchProducts = useCallback(
    async (query: string, options?: SearchOptions) => {
      try {
        setIsLoading(true);
        setError(null);

        if (!isInitialized) {
          throw new Error('Search service is not initialized');
        }

        const results = await searchService.searchProducts(query, options);
        setSearchResults(results);

        // Update search history after search
        setSearchHistory(searchService.getSearchHistory());

        return results;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search products');
        console.error('Error searching products:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [searchService, isInitialized]
  );

  /**
   * Clear search history
   */
  const clearSearchHistory = useCallback(() => {
    try {
      searchService.clearSearchHistory();
      setSearchHistory([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear search history');
      console.error('Error clearing search history:', err);
    }
  }, [searchService]);

  /**
   * Search with a query and update current search query state
   */
  const search = useCallback(
    (query: string) => {
      setSearchQuery(query);
      return performSearch(query);
    },
    [performSearch]
  );

  return {
    isInitialized,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchHistory,
    search,
    searchProducts,
    clearSearchHistory,
    searchOptions,
    setSearchFilters,
    setSearchField,
  };
};
