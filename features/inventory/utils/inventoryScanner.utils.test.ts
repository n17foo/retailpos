/**
 * inventoryScanner.utils — unit tests
 *
 * Tests the pure barcode-matching logic with no React or RN dependencies.
 */

import { findInventoryScanMatch, InventoryItem } from './inventoryScanner.utils';

const items: InventoryItem[] = [
  { productId: 'prod-1', variantId: 'var-a', name: 'Red Widget', sku: 'SKU-001', quantity: 10 },
  { productId: 'prod-2', variantId: 'var-b', name: 'Blue Widget', sku: 'SKU-002', quantity: 5 },
  { productId: 'prod-3', name: 'No-SKU Item', quantity: 3 }, // no SKU
];

describe('findInventoryScanMatch', () => {
  // ── Matching by SKU ──────────────────────────────────────────────────

  it('matches an item by SKU', () => {
    const result = findInventoryScanMatch('SKU-001', items);

    expect(result).not.toBeNull();
    expect(result!.itemName).toBe('Red Widget');
    expect(result!.quantity).toBe(10);
  });

  it('matches the correct item when multiple SKUs exist', () => {
    const result = findInventoryScanMatch('SKU-002', items);

    expect(result!.itemName).toBe('Blue Widget');
    expect(result!.quantity).toBe(5);
  });

  // ── Matching by productId ────────────────────────────────────────────

  it('matches an item by productId when no SKU is set', () => {
    const result = findInventoryScanMatch('prod-3', items);

    expect(result).not.toBeNull();
    expect(result!.itemName).toBe('No-SKU Item');
  });

  it('matches by productId even when a SKU exists', () => {
    const result = findInventoryScanMatch('prod-1', items);

    expect(result).not.toBeNull();
    expect(result!.itemName).toBe('Red Widget');
  });

  // ── itemKey format ───────────────────────────────────────────────────

  it('builds itemKey as productId-variantId', () => {
    const result = findInventoryScanMatch('SKU-001', items);

    expect(result!.itemKey).toBe('prod-1-var-a');
  });

  it('builds itemKey with empty suffix when variantId is absent', () => {
    const result = findInventoryScanMatch('prod-3', items);

    expect(result!.itemKey).toBe('prod-3-');
  });

  // ── No match ────────────────────────────────────────────────────────

  it('returns null for an unknown barcode', () => {
    const result = findInventoryScanMatch('UNKNOWN-999', items);

    expect(result).toBeNull();
  });

  it('returns null for an empty barcode string', () => {
    const result = findInventoryScanMatch('', items);

    expect(result).toBeNull();
  });

  it('returns null when the items list is empty', () => {
    const result = findInventoryScanMatch('SKU-001', []);

    expect(result).toBeNull();
  });

  // ── Case sensitivity ─────────────────────────────────────────────────

  it('is case-sensitive — does not match wrong case', () => {
    const result = findInventoryScanMatch('sku-001', items);

    expect(result).toBeNull();
  });

  // ── Quantity passthrough ─────────────────────────────────────────────

  it('returns the exact quantity from the matched item', () => {
    const singleItem: InventoryItem[] = [{ productId: 'p1', name: 'Thing', sku: 'T1', quantity: 42 }];
    const result = findInventoryScanMatch('T1', singleItem);

    expect(result!.quantity).toBe(42);
  });
});
