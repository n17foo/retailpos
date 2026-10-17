import { ECommercePlatform } from './platforms';
import { toPlatformProductId, toPlatformVariantId } from './platformIds';

describe('platform ids', () => {
  const shopify = ECommercePlatform.SHOPIFY;

  it('prefers the stored raw product id', () => {
    expect(toPlatformProductId(shopify, { productId: 'shopify-123', originalId: '123' })).toBe('123');
  });

  it('strips the platform prefix when no raw id is stored', () => {
    expect(toPlatformProductId(shopify, { productId: 'shopify-123' })).toBe('123');
    expect(toPlatformProductId(shopify, { productId: '123' })).toBe('123');
  });

  it('extracts the raw variant id from the app variant id', () => {
    expect(toPlatformVariantId(shopify, { productId: 'shopify-123', originalId: '123', variantId: 'shopify-123-456' })).toBe('456');
  });

  it('keeps variant ids that contain dashes (e.g. GUIDs)', () => {
    const guid = '3c2f-aa11-77';
    expect(toPlatformVariantId(ECommercePlatform.WIX, { productId: 'wix-p-1', originalId: 'p-1', variantId: `wix-p-1-${guid}` })).toBe(
      guid
    );
  });

  it('maps the synthetic default variant to no variant', () => {
    expect(toPlatformVariantId(shopify, { productId: 'shopify-9', originalId: '9', variantId: 'shopify-9-default' })).toBeUndefined();
  });

  it('leaves an already raw variant id alone', () => {
    expect(toPlatformVariantId(shopify, { productId: 'shopify-9', originalId: '9', variantId: '77' })).toBe('77');
  });
});
