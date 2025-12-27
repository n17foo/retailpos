import { useState, useEffect, useCallback, useMemo } from 'react';
import { ProductServiceFactory } from '../services/product/productServiceFactory';
import { ECommercePlatform } from '../utils/platforms';
import {
  getDefaultVariant,
  toProductSummary,
  UnifiedProduct,
  UnifiedProductQueryOptions,
  UnifiedProductSummary,
} from '../models/UnifiedProduct';
import { mapToUnifiedProducts } from '../models/mappers/ProductMapper';

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
 * Fetches products from the configured platform and converts them to unified format
 */
export const useUnifiedProducts = (platform?: ECommercePlatform, initialOptions?: UnifiedProductQueryOptions): UseUnifiedProductsReturn => {
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [currentOptions, setCurrentOptions] = useState<UnifiedProductQueryOptions>(initialOptions || { page: 1, limit: 50 });

  // Compute product summaries from full products
  const productSummaries = useMemo(() => {
    return products.map(toProductSummary);
  }, [products]);

  // Check if there are more pages
  const hasMore = currentPage < totalPages;

  // Fetch products from the service
  const fetchProducts = useCallback(
    async (options?: UnifiedProductQueryOptions) => {
      console.log('[useProducts] Starting fetchProducts, platform:', platform, 'options:', options);
      setIsLoading(true);
      setError(null);

      try {
        const productServiceFactory = ProductServiceFactory.getInstance();
        console.log('[useProducts] Got factory instance');
        const service = productServiceFactory.getService(platform);
        console.log('[useProducts] Got service:', !!service);

        if (!service) {
          throw new Error('Product service not available');
        }

        const queryOptions = options || currentOptions;

        // Convert unified options to service options
        const serviceOptions = {
          page: queryOptions.page || 1,
          limit: queryOptions.limit || 50,
          category: queryOptions.categoryId,
          search: queryOptions.search,
          ids: queryOptions.ids,
          includeOutOfStock: queryOptions.includeOutOfStock,
          cursor: queryOptions.cursor,
        };

        const result = await service.getProducts(serviceOptions);
        console.log('[useProducts] Service returned', result?.products?.length || 0, 'products');
        if (result?.products?.length > 0) {
          console.log('[useProducts] First product:', JSON.stringify(result.products[0]));
        }

        // Determine the platform for mapping
        const mappingPlatform = platform || ECommercePlatform.CUSTOM;

        // Map to unified products
        const unifiedProducts = mapToUnifiedProducts(result.products, mappingPlatform);
        console.log('[useProducts] Mapped to', unifiedProducts.length, 'unified products');

        // Update state
        if (queryOptions.page === 1) {
          setProducts(unifiedProducts);
        } else {
          // Append for pagination
          setProducts(prev => [...prev, ...unifiedProducts]);
        }

        setCurrentPage(result.pagination.currentPage);
        setTotalPages(result.pagination.totalPages);
        setTotalItems(result.pagination.totalItems);
        setCurrentOptions(queryOptions);
      } catch (err) {
        console.error('[useProducts] Error fetching products:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch products');
      } finally {
        setIsLoading(false);
      }
    },
    [platform, currentOptions]
  );

  // Load more products (next page)
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    await fetchProducts({
      ...currentOptions,
      page: currentPage + 1,
    });
  }, [isLoading, hasMore, currentOptions, currentPage, fetchProducts]);

  // Refresh products (reset to page 1)
  const refresh = useCallback(async () => {
    await fetchProducts({
      ...currentOptions,
      page: 1,
    });
  }, [currentOptions, fetchProducts]);

  // Get a single product by ID
  const getProductById = useCallback(
    (id: string): UnifiedProduct | undefined => {
      return products.find(p => p.id === id);
    },
    [products]
  );

  // Get product summary by ID
  const getProductSummaryById = useCallback(
    (id: string): UnifiedProductSummary | undefined => {
      return productSummaries.find(p => p.id === id);
    },
    [productSummaries]
  );

  // Search products
  const searchProducts = useCallback(
    async (query: string) => {
      await fetchProducts({
        ...currentOptions,
        search: query,
        page: 1,
      });
    },
    [currentOptions, fetchProducts]
  );

  // Filter by category
  const filterByCategory = useCallback(
    async (categoryId: string | null) => {
      await fetchProducts({
        ...currentOptions,
        categoryId: categoryId || undefined,
        page: 1,
      });
    },
    [currentOptions, fetchProducts]
  );

  // Fetch products on mount and when initialOptions change
  useEffect(() => {
    fetchProducts(initialOptions);
  }, [initialOptions?.categoryId, initialOptions?.search, platform]);

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

/**
 * Helper hook to get display-ready product data
 * Returns products in a format ready for ProductGrid
 *
 * Uses backend/service filtering by category name (productType)
 */
export const useProductsForDisplay = (platform?: ECommercePlatform, categoryId?: string | null, categoryName?: string | null) => {
  // Memoize options to prevent unnecessary re-fetches
  const options = useMemo(
    () => ({
      page: 1,
      limit: 100,
      // Pass category name for service-level filtering (mock service uses productType)
      categoryId: categoryName || undefined,
    }),
    [categoryName]
  );

  const { products, productSummaries, isLoading, error, refresh } = useUnifiedProducts(platform, options);

  // Convert to display format expected by ProductGrid
  const displayProducts = useMemo(() => {
    return products.map(product => {
      const defaultVariant = getDefaultVariant(product);
      const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];

      return {
        id: product.id,
        platformId: product.platformId,
        name: product.title,
        price: defaultVariant?.price || 0,
        image: primaryImage?.url ? { uri: primaryImage.url } : null,
        categoryId: product.categoryIds[0] || product.productType || '',
        categoryName: product.productType,
        description: product.description,
        sku: defaultVariant?.sku,
        barcode: defaultVariant?.barcode,
        stock: defaultVariant?.inventoryQuantity || 0,
        isEcommerceProduct: true,
        variantId: defaultVariant?.id,
        platform: product.platform,
      };
    });
  }, [products]);

  return {
    products: displayProducts,
    productSummaries,
    isLoading,
    error,
    refresh,
  };
};

export default useUnifiedProducts;
