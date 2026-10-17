import type { UnifiedProduct, UnifiedProductVariant } from '../services/product/types';

/**
 * Single sellability rule shared by every way of adding to the basket
 * (tile, variant picker, scan, search, quantity changes).
 *
 *  - Tracked stock with nothing available: not sellable (no overselling).
 *  - Untracked stock: sellable unless the platform marks it unavailable.
 *  - Platform `allowBackorder` is deliberately ignored: out-of-stock items are never sold.
 */
export const getAvailableQuantity = (
  variant: Pick<UnifiedProductVariant, 'trackInventory' | 'inventoryQuantity'> | undefined
): number | undefined => {
  if (!variant || !variant.trackInventory) return undefined;
  return Math.max(0, variant.inventoryQuantity);
};

export const isVariantSellable = (variant: UnifiedProductVariant | undefined): boolean => {
  if (!variant) return false;
  return variant.trackInventory ? variant.inventoryQuantity > 0 : variant.isAvailable;
};

export const isProductSellable = (product: Pick<UnifiedProduct, 'variants'>): boolean => product.variants.some(isVariantSellable);

export const findVariant = (product: Pick<UnifiedProduct, 'variants'>, variantId: string | undefined): UnifiedProductVariant | undefined =>
  variantId ? product.variants.find(v => v.id === variantId) : undefined;

export const clampToAvailable = (requested: number, available: number | undefined): number =>
  available === undefined ? requested : Math.min(requested, available);
