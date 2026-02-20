import { useState, useCallback, useEffect } from 'react';
import { PlatformServiceRegistry } from '../services/platform/PlatformServiceRegistry';
import { SearchOptions, SearchResult } from '../services/search/SearchServiceInterface';
import { useLogger } from './useLogger';

/**
 * Hook to interact with the SearchService
 */
export const useSearch = () => {
  const searchService = PlatformServiceRegistry.getInstance().getSearchService();
  const logger = useLogger('useSearch');

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
        logger.error({ message: 'Error initializing search service' }, err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    if (!isInitialized) {
      initializeSearchService();
    }
  }, [searchService, isInitialized]);

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
        setSearchHistory(searchService.getSearchHistory());

        return results;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search products');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [searchService, isInitialized]
  );

  /**
   * Set search filter options and re-search if active query exists
   */
  const setSearchFilters = useCallback(
    (options: Partial<SearchOptions>) => {
      setSearchOptions(prevOptions => {
        const newOptions = { ...prevOptions, ...options };
        if (searchQuery) {
          searchProducts(searchQuery, newOptions);
        }
        return newOptions;
      });
    },
    [searchQuery, searchProducts]
  );

  /**
   * Set search field (name, sku, barcode, or all)
   */
  const setSearchField = useCallback(
    (field: 'name' | 'sku' | 'barcode' | 'all') => {
      setSearchOptions(prevOptions => {
        const newOptions = { ...prevOptions, searchField: field };
        if (searchQuery) {
          searchProducts(searchQuery, newOptions);
        }
        return newOptions;
      });
    },
    [searchQuery, searchProducts]
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
    }
  }, [searchService]);

  /**
   * Search with a query and update current search query state
   */
  const search = useCallback(
    (query: string) => {
      setSearchQuery(query);
      return searchProducts(query, searchOptions);
    },
    [searchProducts, searchOptions]
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
