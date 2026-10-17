import { ECommercePlatform } from '../../utils/platforms';
import { UnifiedProduct, UnifiedProductVariant, UnifiedProductOption, UnifiedProductImage } from './types';

/**
 * ============================================================================
 * PRODUCT MAPPER
 * ============================================================================
 * Every platform product service already normalises its API payload into the
 * shared `Product` shape (ProductServiceInterface). This mapper converts that
 * normalised shape into the unified schema, identically for all platforms, so
 * stock, images, options and categories behave the same everywhere.
 * ============================================================================
 */

function generateProductId(platform: ECommercePlatform, platformId: string): string {
  return `${platform}-${platformId}`;
}

function generateVariantId(platform: ECommercePlatform, platformId: string, variantId: string): string {
  return `${platform}-${platformId}-${variantId}`;
}

function generateCategoryId(platform: ECommercePlatform, platformId: string): string {
  return `${platform}-${platformId}`;
}

interface ServiceProductVariant {
  id: string | number;
  title?: string;
  sku?: string;
  barcode?: string;
  price?: number;
  compareAtPrice?: number;
  inventoryQuantity?: number;
  trackInventory?: boolean;
  isAvailable?: boolean;
  weight?: number;
  weightUnit?: string;
  taxable?: boolean;
  taxCode?: string;
  options?: string[];
  imageId?: string;
}

interface ServiceProduct {
  id: string | number;
  name?: string;
  title?: string;
  description?: string;
  price?: number;
  sku?: string;
  barcode?: string;
  stock?: number;
  image?: string;
  images?: Array<string | { id?: string; url?: string; src?: string; alt?: string; position?: number }>;
  category?: string;
  categoryId?: string;
  categoryIds?: string[];
  productType?: string;
  tags?: string[];
  vendor?: string;
  taxProfileId?: string;
  taxCode?: string;
  options?: Array<{ id?: string; name: string; values?: string[] }>;
  variants?: ServiceProductVariant[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

const toDate = (value: Date | string | undefined): Date => (value ? new Date(value) : new Date());

const mapImages = (data: ServiceProduct): UnifiedProductImage[] => {
  const raw = data.images && data.images.length > 0 ? data.images : data.image ? [data.image] : [];
  return raw
    .map((img, index) => {
      const url = typeof img === 'string' ? img : img.url || img.src || '';
      return {
        id: typeof img === 'string' ? `img-${index}` : img.id || `img-${index}`,
        url,
        alt: typeof img === 'string' ? undefined : img.alt,
        position: typeof img === 'string' ? index : (img.position ?? index),
        isPrimary: index === 0,
      };
    })
    .filter(img => img.url);
};

const mapVariant = (
  v: ServiceProductVariant,
  index: number,
  platform: ECommercePlatform,
  platformId: string,
  fallbackTaxCode?: string
): UnifiedProductVariant => {
  const inventoryQuantity = v.inventoryQuantity ?? 0;
  const trackInventory = v.trackInventory ?? true;
  return {
    id: generateVariantId(platform, platformId, String(v.id)),
    title: v.title || 'Default',
    sku: v.sku,
    barcode: v.barcode,
    price: v.price ?? 0,
    compareAtPrice: v.compareAtPrice,
    inventoryQuantity,
    trackInventory,
    allowBackorder: false,
    weight: v.weight,
    weightUnit: (v.weightUnit as UnifiedProductVariant['weightUnit']) || 'g',
    requiresShipping: true,
    taxable: v.taxable ?? true,
    taxCode: v.taxCode ?? fallbackTaxCode,
    optionValues: v.options || [],
    imageId: v.imageId,
    isAvailable: v.isAvailable ?? (trackInventory ? inventoryQuantity > 0 : true),
    position: index,
  };
};

export function mapServiceProduct(data: ServiceProduct, platform: ECommercePlatform = ECommercePlatform.OFFLINE): UnifiedProduct {
  const platformId = String(data.id);

  const variants: UnifiedProductVariant[] =
    data.variants && data.variants.length > 0
      ? data.variants.map((v, index) => mapVariant(v, index, platform, platformId, data.taxCode))
      : [
          mapVariant(
            {
              id: 'default',
              title: 'Default',
              sku: data.sku,
              barcode: data.barcode,
              price: data.price,
              inventoryQuantity: data.stock,
              trackInventory: data.stock !== undefined,
            },
            0,
            platform,
            platformId,
            data.taxCode
          ),
        ];

  const options: UnifiedProductOption[] = (data.options || []).map((option, index) => ({
    id: option.id || option.name,
    name: option.name,
    values: option.values || [],
    position: index,
  }));

  const rawCategoryIds = data.categoryIds && data.categoryIds.length > 0 ? data.categoryIds : data.categoryId ? [data.categoryId] : [];

  return {
    id: generateProductId(platform, platformId),
    platformId,
    platform,
    title: data.title || data.name || 'Unnamed Product',
    description: data.description,
    vendor: data.vendor,
    productType: data.productType || data.category,
    categoryIds: rawCategoryIds.map(id => generateCategoryId(platform, id)),
    tags: data.tags || [],
    options,
    variants,
    images: mapImages(data),
    status: 'active',
    isFeatured: false,
    taxProfileId: data.taxProfileId,
    taxCode: data.taxCode,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    syncedAt: new Date(),
  };
}

/**
 * Map one normalised service product to the unified format
 */
export function mapToUnifiedProduct(data: unknown, platform: ECommercePlatform): UnifiedProduct {
  return mapServiceProduct(data as ServiceProduct, platform);
}

/**
 * Map multiple products
 */
export function mapToUnifiedProducts(data: unknown[], platform: ECommercePlatform): UnifiedProduct[] {
  return data.map(item => mapToUnifiedProduct(item, platform));
}
