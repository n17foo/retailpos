/**
 * useSaleCatalog — catalogue state for the sale screen
 * (docs/specs/system/sales-screen-fast-path-ux.md §4.4).
 *
 * Owns: platform resolution, subtree category filtering, per-category result
 * caching (switching back to a visited category is instant), stale-while-
 * revalidate loading, service-level search, catalogue statistics for adaptive
 * tile density, and every "add to basket" path (tile, search result, id).
 *
 * Mounted once via useSaleScreen → SaleProvider.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useActivePlatform } from './useActivePlatform';
import { useCategoryContext } from '../contexts/CategoryProvider';
import { useProductsForDisplay } from './useProducts';
import { useSearch } from './useSearch';
import { useAddToBasket, getAvailability } from './useAddToBasket';
import { BasketItem as BasketLine } from '../contexts/BasketStateProvider';
import { posConfig } from '../services/config/POSConfigService';
import { buildCategoryFilter } from '../utils/categoryFilter';
import { ECommercePlatform } from '../utils/platforms';
import { notificationService } from '../services/notifications/NotificationService';
import { resolveDisplayProduct } from '../services/product/resolveProduct';
import type { DisplayProduct } from '../services/product/displayProduct';
import type { SearchProduct } from '../services/search/SearchServiceInterface';
import type { TileDensity } from '../utils/responsive.utils';

const ALL_PRODUCTS_KEY = '__all__';

export const useSaleCatalog = () => {
  const { categories, effectiveCategoryId } = useCategoryContext();
  const addUnit = useAddToBasket();

  // Re-read the configured platform whenever the sale screen regains focus so a
  // platform change in Settings is picked up. null = still resolving.
  const isFocused = useIsFocused();
  const { platform: activePlatform, isResolved } = useActivePlatform(undefined, isFocused);
  const currentPlatform = activePlatform ?? null;
  const catalogPlatform = isResolved ? (activePlatform ?? ECommercePlatform.OFFLINE) : null;

  // ── Category-filtered catalogue ──────────────────────────────────────────

  const categoryFilter = useMemo(() => {
    const selected = effectiveCategoryId ? categories.find(c => c.id === effectiveCategoryId) : undefined;
    return selected ? buildCategoryFilter(catalogPlatform ?? undefined, selected, categories) : null;
  }, [effectiveCategoryId, categories, catalogPlatform]);

  const { products, isLoading, error, hasMore, loadMore, refresh } = useProductsForDisplay(catalogPlatform, categoryFilter);

  // Per-category cache: products fetched for a category key are kept so
  // re-selecting a visited category renders instantly (stale-while-revalidate).
  const categoryKey = effectiveCategoryId ?? ALL_PRODUCTS_KEY;
  const cacheRef = useRef<Map<string, DisplayProduct[]>>(new Map());
  const currentKeyRef = useRef(categoryKey);
  const productsRef = useRef(products);
  productsRef.current = products;

  if (currentKeyRef.current !== categoryKey) {
    // Stash the outgoing key's products before the new fetch lands
    cacheRef.current.set(currentKeyRef.current, productsRef.current);
    currentKeyRef.current = categoryKey;
  }

  // Revisiting a category while its fresh page loads → render the cached snapshot
  // instantly; the real page replaces it as soon as the fetch resolves.
  const cachedForKey = cacheRef.current.get(categoryKey);
  const displayProducts = products.length === 0 && isLoading && cachedForKey ? cachedForKey : products;

  // isLoading = nothing to show yet; isRefreshing = grid stays, fetch in flight
  const isCatalogRefreshing = isLoading && displayProducts.length > 0;
  const isCatalogLoading = isLoading && displayProducts.length === 0;

  // ── Service-level search (results replace the catalogue grid) ────────────

  const { search, searchResults, isLoading: isSearching, isInitialized: isSearchReady } = useSearch();
  const [searchQuery, setSearchQuery] = useState('');

  const isSearchActive = searchQuery.trim().length > 0;
  const searchProducts = useMemo(() => {
    if (!searchResults) return [];
    return [...searchResults.localResults, ...searchResults.ecommerceResults];
  }, [searchResults]);

  useEffect(() => {
    search(searchQuery);
  }, [searchQuery, search]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // ── Add paths (all funnel through the shared sellability rule) ───────────

  const addProduct = useCallback(
    async (product: DisplayProduct, variantId?: string): Promise<boolean> => addUnit(product, variantId),
    [addUnit]
  );

  /**
   * Add by product id — used by tile taps and search Enter. Resolves products
   * that are not on the loaded grid page (e.g. deep catalogue hits).
   */
  const addById = useCallback(
    async (productId: string, variantId?: string): Promise<boolean> => {
      const loaded = products.find(p => p.id === productId || p.platformId === productId || p.id === `${catalogPlatform}-${productId}`);
      const product = loaded ?? (catalogPlatform ? await resolveDisplayProduct(catalogPlatform, productId) : undefined);
      if (!product) {
        notificationService.notify('Product not found', 'The product could not be loaded', 'warning');
        return false;
      }
      return addUnit(product, variantId);
    },
    [products, catalogPlatform, addUnit]
  );

  /** Maps a search result to the full display product and adds the exact variant */
  const addSearchProduct = useCallback(
    async (hit: SearchProduct): Promise<boolean> => {
      const loaded = products.find(p => p.id === hit.id || p.platformId === hit.id || p.id === `${catalogPlatform}-${hit.id}`);
      const product = loaded ?? (catalogPlatform ? await resolveDisplayProduct(catalogPlatform, hit.id) : undefined);
      if (!product) {
        notificationService.notify('Product not found', `${hit.name} could not be loaded`, 'warning');
        return false;
      }
      // The hit's barcode/SKU identifies the exact variant when the product has several
      const variant = product.variants?.find(v => v.barcode === hit.barcode || v.sku === hit.sku);
      return addUnit(product, variant?.id);
    },
    [products, catalogPlatform, addUnit]
  );

  /**
   * Omnibar Enter: with a single result (or an exact barcode/SKU match) add it
   * and return to the catalogue; otherwise leave the results visible.
   */
  const submitSearch = useCallback(async (): Promise<'added' | 'browse' | 'idle'> => {
    const query = searchQuery.trim();
    if (!query) return 'idle';

    const exact = searchProducts.find(p => p.sku === query || p.barcode === query);
    const target = exact ?? (searchProducts.length === 1 ? searchProducts[0] : undefined);
    if (!target) return 'browse';

    const added = await addSearchProduct(target);
    if (added) {
      setSearchQuery('');
      return 'added';
    }
    return 'browse';
  }, [searchQuery, searchProducts, addSearchProduct]);

  /** Remaining stock for a basket line, or undefined when unknown / not tracked */
  const getAvailableForItem = useCallback(
    (item: BasketLine): number | undefined => {
      const product = products.find(p => p.id === item.productId);
      return product ? getAvailability(product, item.variantId).available : undefined;
    },
    [products]
  );

  // ── Catalogue statistics → adaptive tile density (§4.4) ─────────────────

  const catalogueStats = useMemo(
    () => ({
      imageRatio: products.length > 0 ? products.filter(p => p.image !== null).length / products.length : 0,
      hasVariants: products.some(p => (p.variants?.length ?? 0) > 1),
    }),
    [products]
  );

  const tileDensity: TileDensity = useMemo(() => {
    const configured = posConfig.values.saleDensity;
    if (configured && configured !== 'auto') return configured;
    return catalogueStats.imageRatio >= 0.5 ? 'large' : 'compact';
  }, [catalogueStats.imageRatio]);

  return {
    currentPlatform,
    catalogPlatform,
    isPlatformResolved: isResolved,
    // Products
    products,
    displayProducts,
    isCatalogLoading,
    isCatalogRefreshing,
    catalogError: error,
    hasMore,
    loadMore,
    refresh,
    // Search
    searchQuery,
    setSearchQuery,
    isSearchActive,
    isSearching,
    isSearchReady,
    searchProducts,
    clearSearch,
    submitSearch,
    // Add paths
    addProduct,
    addById,
    addSearchProduct,
    getAvailableForItem,
    // Adaptive tiles
    tileDensity,
    catalogueStats,
  };
};
