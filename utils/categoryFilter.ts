import { ECommercePlatform } from './platforms';
import type { UnifiedCategory } from '../services/category/types';
import { getCategoryDescendants } from '../services/category/types';
import type { UnifiedProduct } from '../services/product/types';

export interface CategoryFilter {
  /** Value to hand to the platform product service. Set only when the service can filter this selection exactly. */
  serviceCategory?: string;
  /** Client-side membership test (selected category plus all sub-categories). */
  matches: (product: UnifiedProduct) => boolean;
}

/**
 * Platforms whose product service filters by category server-side.
 * Others (Sylius, Wix, PrestaShop) are filtered on the client.
 */
const SERVICE_FILTER_PLATFORMS: ReadonlySet<ECommercePlatform> = new Set([
  ECommercePlatform.SHOPIFY,
  ECommercePlatform.WOOCOMMERCE,
  ECommercePlatform.BIGCOMMERCE,
  ECommercePlatform.MAGENTO,
  ECommercePlatform.COMMERCEFULL,
  ECommercePlatform.OFFLINE,
]);

/**
 * Builds the product filter for a selected category.
 *
 * - Leaf category on a server-filtering platform: ask the service (id for online platforms,
 *   name for the offline catalogue where categories are product types).
 * - Category with sub-categories, or a platform without server-side filtering: fetch normally and
 *   match on the client by category id, product type or tag/category name across the whole subtree.
 */
export function buildCategoryFilter(
  platform: ECommercePlatform | undefined,
  selected: UnifiedCategory,
  allCategories: UnifiedCategory[]
): CategoryFilter {
  const effectivePlatform = platform ?? ECommercePlatform.OFFLINE;
  const descendantIds = getCategoryDescendants(allCategories, selected.id);
  const subtree = [selected, ...allCategories.filter(c => descendantIds.includes(c.id))];
  const ids = new Set(subtree.map(c => c.id));
  const names = new Set(subtree.map(c => c.name.trim().toLowerCase()).filter(Boolean));

  const canUseService = descendantIds.length === 0 && SERVICE_FILTER_PLATFORMS.has(effectivePlatform);
  const serviceCategory = canUseService
    ? effectivePlatform === ECommercePlatform.OFFLINE
      ? selected.name
      : selected.platformId
    : undefined;

  return {
    serviceCategory,
    matches: product =>
      product.categoryIds.some(id => ids.has(id)) ||
      (product.productType ? names.has(product.productType.trim().toLowerCase()) : false) ||
      product.tags.some(tag => names.has(tag.trim().toLowerCase())),
  };
}
