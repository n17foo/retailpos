import { ECommercePlatform } from '../../utils/platforms';
import { UnifiedCategory, UnifiedCategoryStatus, UnifiedCategoryImage } from '../UnifiedCategory';

/**
 * ============================================================================
 * CATEGORY MAPPERS
 * ============================================================================
 * These mappers convert platform-specific category data to the unified schema.
 * Each platform has its own mapping function.
 * ============================================================================
 */

/**
 * Generate a unique app ID for a category
 */
function generateCategoryId(platform: ECommercePlatform, platformId: string): string {
  return `${platform}-${platformId}`;
}

// ============================================================================
// SHOPIFY MAPPER (Collections)
// ============================================================================

interface ShopifyCollection {
  id: number | string;
  title: string;
  handle?: string;
  body_html?: string;
  image?: {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  sort_order?: string;
  products_count?: number;
  published_at?: string;
  updated_at?: string;
}

export function mapShopifyCollection(data: ShopifyCollection): UnifiedCategory {
  const platformId = String(data.id);
  const platform = ECommercePlatform.SHOPIFY;

  const image: UnifiedCategoryImage | undefined = data.image
    ? {
        url: data.image.src,
        alt: data.image.alt,
        width: data.image.width,
        height: data.image.height,
      }
    : undefined;

  return {
    id: generateCategoryId(platform, platformId),
    platformId,
    platform,
    name: data.title,
    description: data.body_html,
    handle: data.handle,
    parentId: undefined, // Shopify collections are flat
    image,
    position: 0,
    productCount: data.products_count ?? 0,
    status: data.published_at ? 'active' : 'hidden',
    isFeatured: false,
    level: 0,
    path: [data.title],
    createdAt: undefined,
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    syncedAt: new Date(),
  };
}

// ============================================================================
// WOOCOMMERCE MAPPER
// ============================================================================

interface WooCommerceCategory {
  id: number;
  name: string;
  slug?: string;
  parent?: number;
  description?: string;
  image?: {
    id: number;
    src: string;
    alt?: string;
  };
  menu_order?: number;
  count?: number;
}

export function mapWooCommerceCategory(data: WooCommerceCategory, allCategories?: WooCommerceCategory[]): UnifiedCategory {
  const platformId = String(data.id);
  const platform = ECommercePlatform.WOOCOMMERCE;

  const image: UnifiedCategoryImage | undefined = data.image
    ? {
        url: data.image.src,
        alt: data.image.alt,
      }
    : undefined;

  // Calculate level and path
  let level = 0;
  const path: string[] = [data.name];

  if (allCategories && data.parent && data.parent > 0) {
    let parentId = data.parent;
    while (parentId > 0) {
      const parent = allCategories.find(c => c.id === parentId);
      if (parent) {
        level++;
        path.unshift(parent.name);
        parentId = parent.parent ?? 0;
      } else {
        break;
      }
    }
  }

  return {
    id: generateCategoryId(platform, platformId),
    platformId,
    platform,
    name: data.name,
    description: data.description,
    handle: data.slug,
    parentId: data.parent && data.parent > 0 ? generateCategoryId(platform, String(data.parent)) : undefined,
    image,
    position: data.menu_order ?? 0,
    productCount: data.count ?? 0,
    status: 'active',
    isFeatured: false,
    level,
    path,
    syncedAt: new Date(),
  };
}

// ============================================================================
// BIGCOMMERCE MAPPER
// ============================================================================

interface BigCommerceCategory {
  id: number;
  name: string;
  parent_id?: number;
  description?: string;
  image_url?: string;
  sort_order?: number;
  is_visible?: boolean;
  custom_url?: { url: string };
}

export function mapBigCommerceCategory(data: BigCommerceCategory, allCategories?: BigCommerceCategory[]): UnifiedCategory {
  const platformId = String(data.id);
  const platform = ECommercePlatform.BIGCOMMERCE;

  const image: UnifiedCategoryImage | undefined = data.image_url
    ? {
        url: data.image_url,
      }
    : undefined;

  // Calculate level and path
  let level = 0;
  const path: string[] = [data.name];

  if (allCategories && data.parent_id && data.parent_id > 0) {
    let parentId = data.parent_id;
    while (parentId > 0) {
      const parent = allCategories.find(c => c.id === parentId);
      if (parent) {
        level++;
        path.unshift(parent.name);
        parentId = parent.parent_id ?? 0;
      } else {
        break;
      }
    }
  }

  return {
    id: generateCategoryId(platform, platformId),
    platformId,
    platform,
    name: data.name,
    description: data.description,
    handle: data.custom_url?.url,
    parentId: data.parent_id && data.parent_id > 0 ? generateCategoryId(platform, String(data.parent_id)) : undefined,
    image,
    position: data.sort_order ?? 0,
    productCount: 0,
    status: data.is_visible ? 'active' : 'hidden',
    isFeatured: false,
    level,
    path,
    syncedAt: new Date(),
  };
}

// ============================================================================
// MAGENTO MAPPER
// ============================================================================

interface MagentoCategory {
  id: number;
  name: string;
  parent_id?: number;
  is_active?: boolean;
  position?: number;
  level?: number;
  product_count?: number;
  children_data?: MagentoCategory[];
  custom_attributes?: Array<{ attribute_code: string; value: string }>;
}

export function mapMagentoCategory(data: MagentoCategory, parentPath: string[] = []): UnifiedCategory {
  const platformId = String(data.id);
  const platform = ECommercePlatform.MAGENTO;

  // Get image from custom attributes
  const imageAttr = data.custom_attributes?.find(a => a.attribute_code === 'image');
  const image: UnifiedCategoryImage | undefined = imageAttr
    ? {
        url: imageAttr.value,
      }
    : undefined;

  // Get description from custom attributes
  const descAttr = data.custom_attributes?.find(a => a.attribute_code === 'description');

  const path = [...parentPath, data.name];

  return {
    id: generateCategoryId(platform, platformId),
    platformId,
    platform,
    name: data.name,
    description: descAttr?.value,
    parentId: data.parent_id && data.parent_id > 1 ? generateCategoryId(platform, String(data.parent_id)) : undefined,
    image,
    position: data.position ?? 0,
    productCount: data.product_count ?? 0,
    status: data.is_active ? 'active' : 'hidden',
    isFeatured: false,
    level: data.level ?? parentPath.length,
    path,
    syncedAt: new Date(),
  };
}

// ============================================================================
// PRESTASHOP MAPPER
// ============================================================================

interface PrestaShopCategory {
  id: number;
  name: string | Array<{ id: number; value: string }>;
  id_parent?: number;
  description?: string | Array<{ id: number; value: string }>;
  active?: string | boolean;
  position?: number;
  level_depth?: number;
}

export function mapPrestaShopCategory(data: PrestaShopCategory): UnifiedCategory {
  const platformId = String(data.id);
  const platform = ECommercePlatform.PRESTASHOP;

  // Handle multilingual fields
  const name = Array.isArray(data.name) ? data.name[0]?.value || 'Unnamed' : data.name;
  const description = Array.isArray(data.description) ? data.description[0]?.value : data.description;

  const isActive = data.active === '1' || data.active === true;

  return {
    id: generateCategoryId(platform, platformId),
    platformId,
    platform,
    name,
    description,
    parentId: data.id_parent && data.id_parent > 1 ? generateCategoryId(platform, String(data.id_parent)) : undefined,
    position: data.position ?? 0,
    productCount: 0,
    status: isActive ? 'active' : 'hidden',
    isFeatured: false,
    level: data.level_depth ?? 0,
    path: [name],
    syncedAt: new Date(),
  };
}

// ============================================================================
// GENERIC/CUSTOM MAPPER
// ============================================================================

interface GenericCategory {
  id: string | number;
  name: string;
  description?: string;
  parentId?: string | number;
  image?: string;
  position?: number;
  productCount?: number;
}

export function mapGenericCategory(data: GenericCategory, platform: ECommercePlatform = ECommercePlatform.CUSTOM): UnifiedCategory {
  const platformId = String(data.id);

  const image: UnifiedCategoryImage | undefined = data.image
    ? {
        url: data.image,
      }
    : undefined;

  return {
    id: generateCategoryId(platform, platformId),
    platformId,
    platform,
    name: data.name,
    description: data.description,
    parentId: data.parentId ? generateCategoryId(platform, String(data.parentId)) : undefined,
    image,
    position: data.position ?? 0,
    productCount: data.productCount ?? 0,
    status: 'active',
    isFeatured: false,
    level: 0,
    path: [data.name],
    syncedAt: new Date(),
  };
}

// ============================================================================
// MAIN MAPPER FUNCTION
// ============================================================================

/**
 * Map any platform category data to unified format
 */
export function mapToUnifiedCategory(
  data: unknown,
  platform: ECommercePlatform,
  context?: { allCategories?: unknown[]; parentPath?: string[] }
): UnifiedCategory {
  switch (platform) {
    case ECommercePlatform.SHOPIFY:
      return mapShopifyCollection(data as ShopifyCollection);
    case ECommercePlatform.WOOCOMMERCE:
      return mapWooCommerceCategory(data as WooCommerceCategory, context?.allCategories as WooCommerceCategory[]);
    case ECommercePlatform.BIGCOMMERCE:
      return mapBigCommerceCategory(data as BigCommerceCategory, context?.allCategories as BigCommerceCategory[]);
    case ECommercePlatform.MAGENTO:
      return mapMagentoCategory(data as MagentoCategory, context?.parentPath);
    case ECommercePlatform.PRESTASHOP:
      return mapPrestaShopCategory(data as PrestaShopCategory);
    case ECommercePlatform.CUSTOM:
    default:
      return mapGenericCategory(data as GenericCategory, platform);
  }
}

/**
 * Map multiple categories
 */
export function mapToUnifiedCategories(data: unknown[], platform: ECommercePlatform): UnifiedCategory[] {
  // For hierarchical platforms, pass all categories for path calculation
  const context = { allCategories: data };
  return data.map(item => mapToUnifiedCategory(item, platform, context));
}
