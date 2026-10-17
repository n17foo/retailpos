import { ECommercePlatform } from '../../../../shared/utils/platforms';
import { mapToUnifiedProduct } from './mappers';
import { isVariantSellable } from '../../utils/sellability';

const normalized = {
  id: '1',
  title: 'Tee',
  productType: 'Shirts',
  categoryIds: ['5'],
  tags: ['Summer'],
  options: [{ id: '9', name: 'Size', values: ['S', 'M'] }],
  variants: [
    { id: '11', title: 'S', sku: 'T-S', barcode: '123', price: 10, inventoryQuantity: 5, trackInventory: true, options: ['S'] },
    { id: '12', title: 'M', sku: 'T-M', price: 12, inventoryQuantity: 0, trackInventory: true, options: ['M'] },
    { id: '13', title: 'L', sku: 'T-L', price: 14, inventoryQuantity: 0, trackInventory: false, isAvailable: true, options: ['L'] },
  ],
  images: [{ id: '5', url: 'http://x/y.png', position: 1 }],
};

describe('mapToUnifiedProduct', () => {
  const platforms = [
    ECommercePlatform.SHOPIFY,
    ECommercePlatform.WOOCOMMERCE,
    ECommercePlatform.BIGCOMMERCE,
    ECommercePlatform.MAGENTO,
    ECommercePlatform.SYLIUS,
    ECommercePlatform.WIX,
    ECommercePlatform.PRESTASHOP,
    ECommercePlatform.COMMERCEFULL,
    ECommercePlatform.OFFLINE,
  ];

  it.each(platforms)('maps the normalised service product identically for %s', platform => {
    const unified = mapToUnifiedProduct(normalized, platform);

    expect(unified.id).toBe(`${platform}-1`);
    expect(unified.images.map(i => i.url)).toEqual(['http://x/y.png']);
    expect(unified.options.map(o => o.name)).toEqual(['Size']);
    expect(unified.categoryIds).toEqual([`${platform}-5`]);
    expect(unified.variants.map(v => v.price)).toEqual([10, 12, 14]);
    expect(unified.variants.map(v => v.optionValues)).toEqual([['S'], ['M'], ['L']]);
    expect(unified.variants[0].barcode).toBe('123');
  });

  it('keeps stock rules per variant: tracked in stock, tracked exhausted, untracked', () => {
    const unified = mapToUnifiedProduct(normalized, ECommercePlatform.SHOPIFY);
    expect(unified.variants.map(isVariantSellable)).toEqual([true, false, true]);
  });

  it('treats a missing tracking flag as tracked so unknown stock is not oversold', () => {
    const unified = mapToUnifiedProduct(
      { id: '2', title: 'Mug', variants: [{ id: '1', price: 5, inventoryQuantity: 0 }] },
      ECommercePlatform.WIX
    );
    expect(isVariantSellable(unified.variants[0])).toBe(false);
  });

  it('creates a default untracked variant from product-level data without stock', () => {
    const unified = mapToUnifiedProduct({ id: '3', name: 'Service', price: 20 }, ECommercePlatform.OFFLINE);
    expect(unified.variants).toHaveLength(1);
    expect(unified.variants[0].price).toBe(20);
    expect(isVariantSellable(unified.variants[0])).toBe(true);
  });

  it('keeps an explicit stock of 0 as out of stock', () => {
    const unified = mapToUnifiedProduct({ id: '4', name: 'Gone', price: 20, stock: 0 }, ECommercePlatform.OFFLINE);
    expect(isVariantSellable(unified.variants[0])).toBe(false);
  });
});
