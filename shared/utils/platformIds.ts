import { ECommercePlatform } from './platforms';

/**
 * The POS identifies products and variants with app ids prefixed by the platform
 * (`shopify-123`, `shopify-123-456`). Platform APIs only understand their own raw ids.
 * These helpers convert at the platform boundary.
 */

interface LineIdentity {
  productId: string;
  variantId?: string;
  /** Raw platform product id, when known */
  originalId?: string;
}

export const toPlatformProductId = (platform: ECommercePlatform, item: Pick<LineIdentity, 'productId' | 'originalId'>): string => {
  if (item.originalId) return item.originalId;
  const prefix = `${platform}-`;
  return item.productId.startsWith(prefix) ? item.productId.slice(prefix.length) : item.productId;
};

/** Raw variant id, or undefined for the synthetic "default" variant the POS creates for products without variants */
export const toPlatformVariantId = (platform: ECommercePlatform, item: LineIdentity): string | undefined => {
  if (!item.variantId) return undefined;
  const prefix = `${platform}-${toPlatformProductId(platform, item)}-`;
  const raw = item.variantId.startsWith(prefix) ? item.variantId.slice(prefix.length) : item.variantId;
  return raw === 'default' ? undefined : raw;
};
