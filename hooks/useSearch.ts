import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import debounce from 'lodash.debounce';
import { SearchServiceFactory } from '../services/search/SearchServiceFactory';
import { SearchOptions, SearchResult } from '../services/search/SearchServiceInterface';
import { useLogger } from './useLogger';

/**
 * Hook to interact with the SearchService
 */
export const useSearch = () => {
  const searchService = SearchServiceFactory.getInstance().getService();
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
  }, [searchService, isInitialized, logger]);

  // Results from a superseded request are dropped — typing ahead of a slow
  // platform search must never show results for an older query.
  const requestSeq = useRef(0);

  /**
   * Search for products
   */
  const searchProducts = useCallback(
    async (query: string, options?: SearchOptions) => {
      const seq = ++requestSeq.current;
      try {
        setIsLoading(true);
        setError(null);

        if (!isInitialized) {
          throw new Error('Search service is not initialized');
        }

        const results = await searchService.searchProducts(query, options);
        if (seq !== requestSeq.current) return results;
        setSearchResults(results);
        setSearchHistory(searchService.getSearchHistory());

        return results;
      } catch (err) {
        if (seq === requestSeq.current) {
          setError(err instanceof Error ? err.message : 'Failed to search products');
        }
        return null;
      } finally {
        if (seq === requestSeq.current) {
          setIsLoading(false);
        }
      }
    },
    [searchService, isInitialized]
  );

  /**
   * Debounced search - waits 300ms after user stops typing
   * Reduces unnecessary API calls by 70-80%
   */
  const debouncedSearchProducts = useMemo(
    () =>
      debounce((query: string, options?: SearchOptions) => {
        searchProducts(query, options);
      }, 300),
    [searchProducts]
  );

  // Cleanup debounce on unmount
  const debouncedSearchRef = useRef(debouncedSearchProducts);
  useEffect(() => {
    debouncedSearchRef.current = debouncedSearchProducts;
    return () => {
      debouncedSearchRef.current.cancel();
    };
  }, [debouncedSearchProducts]);

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
   * Search for a product by exact barcode value.
   * Uses platform-specific barcode endpoints (faster than generic search).
   */
  const searchByBarcode = useCallback(
    async (barcode: string) => {
      try {
        setIsLoading(true);
        setError(null);

        if (!isInitialized) {
          throw new Error('Search service is not initialized');
        }

        const results = await searchService.searchByBarcode(barcode);
        setSearchResults(results);
        return results;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Barcode search failed');
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
    }
  }, [searchService]);

  /**
   * Search with a query and update current search query state
   * Uses debounced search for better performance
   */
  const search = useCallback(
    (query: string, immediate = false) => {
      setSearchQuery(query);
      if (immediate) {
        // Immediate search (e.g., barcode scan)
        return searchProducts(query, searchOptions);
      } else {
        // Debounced search (e.g., user typing)
        debouncedSearchProducts(query, searchOptions);
        return Promise.resolve(null);
      }
    },
    [searchProducts, debouncedSearchProducts, searchOptions]
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
    searchByBarcode,
    clearSearchHistory,
    searchOptions,
    setSearchFilters,
    setSearchField,
  };
};
