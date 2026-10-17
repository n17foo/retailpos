import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ECommercePlatform } from '../../../shared/utils/platforms';
import { ProductServiceFactory } from '../services/product/ProductServiceFactory';
import { toProductSummary, UnifiedProduct, UnifiedProductQueryOptions, UnifiedProductSummary } from '../services/product/types';
import { mapToUnifiedProducts } from '../services/product/mappers';
import { toDisplayProduct } from '../services/product/displayProduct';
import { syncEventBus } from '../../multi-register/services/sync/SyncEventBus';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';
import type { CategoryFilter } from '../utils/categoryFilter';
import { useActivePlatform } from '../../platform-clients/hooks/useActivePlatform';

/**
 * Hook state interface
 */
interface UseUnifiedProductsState {
  /** Full product list */
  products: UnifiedProduct[];
  /** Lightweight product summaries for display */
  productSummaries: UnifiedProductSummary[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Current page */
  currentPage: number;
  /** Total pages available */
  totalPages: number;
  /** Total items available */
  totalItems: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

/**
 * Hook return interface
 */
interface UseUnifiedProductsReturn extends UseUnifiedProductsState {
  /** Fetch products with options */
  fetchProducts: (options?: UnifiedProductQueryOptions) => Promise<void>;
  /** Load next page */
  loadMore: () => Promise<void>;
  /** Refresh products (reset to page 1) */
  refresh: () => Promise<void>;
  /** Get a single product by ID */
  getProductById: (id: string) => UnifiedProduct | undefined;
  /** Get product summary by ID */
  getProductSummaryById: (id: string) => UnifiedProductSummary | undefined;
  /** Search products */
  searchProducts: (query: string) => Promise<void>;
  /** Filter by category */
  filterByCategory: (categoryId: string | null) => Promise<void>;
}

/**
 * Hook for managing unified products
 * Fetches products from the configured platform and converts them to unified format.
 * When no platform is given, the persisted e-commerce platform is used (offline catalogue otherwise).
 *
 * `initialOptions` must be referentially stable (memoise it): a change triggers a fresh page-1 fetch.
 */
export const useUnifiedProducts = (
  platform?: ECommercePlatform | null,
  initialOptions?: UnifiedProductQueryOptions
): UseUnifiedProductsReturn => {
  const { platform: activePlatform, isResolved } = useActivePlatform(platform);
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Options + cursor of the latest request live in a ref so fetchProducts stays referentially stable
  // (state here would re-create the callback after every fetch and re-trigger the fetch effect).
  const optionsRef = useRef<UnifiedProductQueryOptions>(initialOptions || { page: 1, limit: 50 });
  const requestIdRef = useRef(0);

  const productSummaries = useMemo(() => products.map(toProductSummary), [products]);

  const hasMore = currentPage < totalPages;

  const fetchProducts = useCallback(
    async (options?: UnifiedProductQueryOptions) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const service = ProductServiceFactory.getInstance().getService(activePlatform || ECommercePlatform.OFFLINE);

        if (!service) {
          throw new Error('Product service not available');
        }

        const queryOptions = options || optionsRef.current;

        const result = await service.getProducts({
          page: queryOptions.page || 1,
          limit: queryOptions.limit || 50,
          category: queryOptions.categoryId,
          search: queryOptions.search,
          ids: queryOptions.ids,
          includeOutOfStock: queryOptions.includeOutOfStock,
          cursor: queryOptions.cursor,
        });

        // A newer request superseded this one (e.g. quick category switching)
        if (requestId !== requestIdRef.current) return;

        const unifiedProducts = mapToUnifiedProducts(result.products, activePlatform || ECommercePlatform.OFFLINE);

        if ((queryOptions.page || 1) === 1) {
          setProducts(unifiedProducts);
        } else {
          setProducts(prev => [...prev, ...unifiedProducts]);
        }

        setCurrentPage(result.pagination.currentPage);
        setTotalPages(result.pagination.totalPages);
        setTotalItems(result.pagination.totalItems);
        // Persist cursor for the next loadMore() call (Shopify cursor-based pagination)
        optionsRef.current = { ...queryOptions, cursor: result.pagination.nextCursor };
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch products');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [activePlatform]
  );

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    await fetchProducts({
      ...optionsRef.current,
      page: currentPage + 1,
    });
  }, [isLoading, hasMore, currentPage, fetchProducts]);

  const refresh = useCallback(async () => {
    await fetchProducts({
      ...optionsRef.current,
      page: 1,
      cursor: undefined,
    });
  }, [fetchProducts]);

  const getProductById = useCallback((id: string): UnifiedProduct | undefined => products.find(p => p.id === id), [products]);

  const getProductSummaryById = useCallback(
    (id: string): UnifiedProductSummary | undefined => productSummaries.find(p => p.id === id),
    [productSummaries]
  );

  const searchProducts = useCallback(
    async (query: string) => {
      await fetchProducts({ ...optionsRef.current, search: query, page: 1, cursor: undefined });
    },
    [fetchProducts]
  );

  const filterByCategory = useCallback(
    async (categoryId: string | null) => {
      await fetchProducts({ ...optionsRef.current, categoryId: categoryId || undefined, page: 1, cursor: undefined });
    },
    [fetchProducts]
  );

  // Fetch on mount, once the platform is known, and whenever the platform or initialOptions change
  useEffect(() => {
    if (!isResolved) return;
    optionsRef.current = initialOptions || { page: 1, limit: 50 };
    fetchProducts(initialOptions);
  }, [fetchProducts, initialOptions, isResolved]);

  // Subscribe to sync events for real-time updates (spec: multi-register.md §2.7.1-2.7.5)
  useEffect(() => {
    if (!instoreApiConfig.isClient) {
      return; // Only client registers need to listen for server events
    }

    const unsubscribeProductUpdated = syncEventBus.on('product:updated', () => {
      refresh();
    });

    const unsubscribeInventoryUpdated = syncEventBus.on('inventory:updated', () => {
      refresh();
    });

    return () => {
      unsubscribeProductUpdated();
      unsubscribeInventoryUpdated();
    };
  }, [refresh]);

  return {
    products,
    productSummaries,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalItems,
    hasMore,
    fetchProducts,
    loadMore,
    refresh,
    getProductById,
    getProductSummaryById,
    searchProducts,
    filterByCategory,
  };
};

/** Pages fetched at most while a client-side category filter looks for enough matches */
const MAX_FILTER_PAGES = 10;
/** Matches wanted before auto-paging stops */
const MIN_FILTERED_RESULTS = 24;

/**
 * Helper hook to get display-ready product data
 * Returns products in a format ready for ProductGrid.
 *
 * Category filtering is delegated to the platform service when it can filter exactly, and otherwise
 * done on the client across the whole sub-category tree (loading further pages until enough match).
 */
export const useProductsForDisplay = (platform?: ECommercePlatform | null, categoryFilter?: CategoryFilter | null) => {
  const serviceCategory = categoryFilter?.serviceCategory;

  const options = useMemo(
    () => ({
      page: 1,
      limit: 100,
      // Out-of-stock products stay visible (greyed out) so cashiers see why they cannot be sold
      includeOutOfStock: true,
      categoryId: serviceCategory,
    }),
    [serviceCategory]
  );

  const { products, productSummaries, isLoading, error, currentPage, refresh, hasMore, loadMore } = useUnifiedProducts(platform, options);

  const needsClientFilter = !!categoryFilter && !categoryFilter.serviceCategory;

  const visibleProducts = useMemo(
    () => (needsClientFilter && categoryFilter ? products.filter(categoryFilter.matches) : products),
    [products, needsClientFilter, categoryFilter]
  );

  // Client-side filtering can leave a page nearly empty: keep paging (bounded) until enough products match
  useEffect(() => {
    if (needsClientFilter && !isLoading && hasMore && visibleProducts.length < MIN_FILTERED_RESULTS && currentPage < MAX_FILTER_PAGES) {
      loadMore();
    }
  }, [needsClientFilter, isLoading, hasMore, visibleProducts.length, currentPage, loadMore]);

  const displayProducts = useMemo(() => visibleProducts.map(toDisplayProduct), [visibleProducts]);

  return {
    products: displayProducts,
    productSummaries,
    isLoading,
    error,
    refresh,
    hasMore,
    loadMore,
  };
};
