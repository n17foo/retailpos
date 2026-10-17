import type { ImageSourcePropType } from 'react-native';
import { ECommercePlatform } from '../../utils/platforms';
import { getAvailableQuantity, isProductSellable } from '../../utils/sellability';
import { getDefaultVariant, UnifiedProduct, UnifiedProductOption, UnifiedProductVariant } from './types';

/**
 * Display-ready product used by the sale grid, scan and search paths.
 * Derived from UnifiedProduct so every way of adding to the basket sees the same data.
 */
export interface DisplayProduct {
  /** Unique app ID (platform-prefixed) */
  id: string;
  /** Original platform ID */
  platformId?: string;
  /** Product name/title */
  name: string;
  /** Price of default variant */
  price: number;
  /** Product image */
  image: ImageSourcePropType | null;
  /** Quantity in cart */
  quantity?: number;
  /** Category ID */
  categoryId?: string;
  /** Category name (productType) */
  categoryName?: string;
  /** SKU */
  sku?: string;
  /** Barcode */
  barcode?: string;
  /** Available stock of the default variant; undefined when stock is not tracked */
  stock?: number;
  /** Whether at least one variant can be sold (single rule shared by every add path) */
  sellable: boolean;
  /** Whether this is from an ecommerce platform */
  isEcommerceProduct?: boolean;
  /** Variant ID */
  variantId?: string;
  /** Source platform */
  platform?: ECommercePlatform;
  /** Product description */
  description?: string;
  /** All variants — present when product has multiple variants */
  variants?: UnifiedProductVariant[];
  /** Product options (e.g. Size, Color) — present when product has variants */
  options?: UnifiedProductOption[];
  /** Offline: tax profile ID */
  taxProfileId?: string;
  /** Online: platform tax code/class */
  taxCode?: string;
  /** Whether the default variant is taxable */
  taxable?: boolean;
}

export const toDisplayProduct = (product: UnifiedProduct): DisplayProduct => {
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
    stock: getAvailableQuantity(defaultVariant),
    sellable: isProductSellable(product),
    isEcommerceProduct: product.platform !== ECommercePlatform.OFFLINE,
    variantId: defaultVariant?.id,
    platform: product.platform,
    variants: product.variants.length > 1 ? product.variants : undefined,
    options: product.options.length > 0 ? product.options : undefined,
    taxProfileId: product.taxProfileId,
    taxCode: product.taxCode ?? defaultVariant?.taxCode,
    taxable: defaultVariant?.taxable,
  };
};
