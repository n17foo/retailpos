import { ECommercePlatform } from './platforms';
import { buildCategoryFilter } from './categoryFilter';
import type { UnifiedCategory } from '../services/category/types';
import type { UnifiedProduct } from '../services/product/types';

const category = (id: string, name: string, platform: ECommercePlatform, parentId?: string): UnifiedCategory => ({
  id: `${platform}-${id}`,
  platformId: id,
  platform,
  name,
  parentId: parentId ? `${platform}-${parentId}` : undefined,
  position: 0,
  productCount: 0,
  status: 'active',
  isFeatured: false,
  level: parentId ? 1 : 0,
  path: [],
  syncedAt: new Date(),
});

const product = (overrides: Partial<UnifiedProduct>): UnifiedProduct =>
  ({
    id: 'p',
    categoryIds: [],
    tags: [],
    variants: [],
    options: [],
    images: [],
    ...overrides,
  }) as unknown as UnifiedProduct;

describe('buildCategoryFilter', () => {
  const woo = ECommercePlatform.WOOCOMMERCE;
  const categories = [
    category('10', 'Drinks', woo),
    category('11', 'Hot', woo, '10'),
    category('12', 'Cold', woo, '10'),
    category('20', 'Food', woo),
  ];

  it('asks the service by platform id for a leaf category on an id-based platform', () => {
    const filter = buildCategoryFilter(woo, categories[3], categories);
    expect(filter.serviceCategory).toBe('20');
  });

  it('uses the category name for the offline catalogue', () => {
    const offline = [category('Drinks', 'Drinks', ECommercePlatform.OFFLINE)];
    expect(buildCategoryFilter(ECommercePlatform.OFFLINE, offline[0], offline).serviceCategory).toBe('Drinks');
  });

  it('uses the Shopify collection id, not the collection title', () => {
    const shopify = [category('99887766', 'Summer', ECommercePlatform.SHOPIFY)];
    expect(buildCategoryFilter(ECommercePlatform.SHOPIFY, shopify[0], shopify).serviceCategory).toBe('99887766');
  });

  it('filters on the client for a category with sub-categories and includes the whole subtree', () => {
    const filter = buildCategoryFilter(woo, categories[0], categories);
    expect(filter.serviceCategory).toBeUndefined();
    expect(filter.matches(product({ categoryIds: [`${woo}-11`] }))).toBe(true);
    expect(filter.matches(product({ categoryIds: [`${woo}-12`] }))).toBe(true);
    expect(filter.matches(product({ categoryIds: [`${woo}-20`] }))).toBe(false);
  });

  it('matches on product type or tag names when ids are not available', () => {
    const filter = buildCategoryFilter(woo, categories[0], categories);
    expect(filter.matches(product({ productType: 'hot' }))).toBe(true);
    expect(filter.matches(product({ tags: ['Cold'] }))).toBe(true);
    expect(filter.matches(product({ tags: ['Other'] }))).toBe(false);
  });

  it('filters on the client for platforms without server-side category filtering', () => {
    const sylius = [category('t1', 'Shirts', ECommercePlatform.SYLIUS)];
    const filter = buildCategoryFilter(ECommercePlatform.SYLIUS, sylius[0], sylius);
    expect(filter.serviceCategory).toBeUndefined();
    expect(filter.matches(product({ tags: ['shirts'] }))).toBe(true);
  });
});
