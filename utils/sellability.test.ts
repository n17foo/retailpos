import type { UnifiedProductVariant } from '../services/product/types';
import { clampToAvailable, getAvailableQuantity, isProductSellable, isVariantSellable } from './sellability';

const variant = (overrides: Partial<UnifiedProductVariant> = {}): UnifiedProductVariant => ({
  id: 'v1',
  title: 'Default',
  price: 10,
  inventoryQuantity: 0,
  trackInventory: true,
  allowBackorder: false,
  weightUnit: 'g',
  requiresShipping: true,
  taxable: true,
  optionValues: [],
  isAvailable: true,
  position: 0,
  ...overrides,
});

describe('isVariantSellable', () => {
  it('blocks tracked stock that is exhausted', () => {
    expect(isVariantSellable(variant({ trackInventory: true, inventoryQuantity: 0 }))).toBe(false);
  });

  it('allows tracked stock that is available', () => {
    expect(isVariantSellable(variant({ trackInventory: true, inventoryQuantity: 3 }))).toBe(true);
  });

  it('allows untracked stock even when the quantity is 0', () => {
    expect(isVariantSellable(variant({ trackInventory: false, inventoryQuantity: 0, isAvailable: true }))).toBe(true);
  });

  it('blocks untracked stock the platform marks unavailable', () => {
    expect(isVariantSellable(variant({ trackInventory: false, isAvailable: false }))).toBe(false);
  });

  it('ignores backorder: out-of-stock items are never sold', () => {
    expect(isVariantSellable(variant({ trackInventory: true, inventoryQuantity: 0, allowBackorder: true, isAvailable: true }))).toBe(false);
  });

  it('is false when there is no variant', () => {
    expect(isVariantSellable(undefined)).toBe(false);
  });
});

describe('isProductSellable', () => {
  it('is sellable when any variant is sellable', () => {
    const product = { variants: [variant({ id: 'a', inventoryQuantity: 0 }), variant({ id: 'b', inventoryQuantity: 2 })] };
    expect(isProductSellable(product)).toBe(true);
  });

  it('is not sellable when every variant is exhausted', () => {
    const product = { variants: [variant({ id: 'a' }), variant({ id: 'b' })] };
    expect(isProductSellable(product)).toBe(false);
  });
});

describe('getAvailableQuantity / clampToAvailable', () => {
  it('returns undefined for untracked stock', () => {
    expect(getAvailableQuantity(variant({ trackInventory: false, inventoryQuantity: 0 }))).toBeUndefined();
  });

  it('never returns a negative quantity', () => {
    expect(getAvailableQuantity(variant({ trackInventory: true, inventoryQuantity: -4 }))).toBe(0);
  });

  it('clamps to the available quantity only when tracked', () => {
    expect(clampToAvailable(5, 3)).toBe(3);
    expect(clampToAvailable(5, undefined)).toBe(5);
  });
});
