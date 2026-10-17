/**
 * Pure utility extracted from useInventoryScanner.
 * Kept separate so it can be unit-tested without React or RN dependencies.
 */

export interface InventoryItem {
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  quantity: number;
}

export interface ScanMatch {
  itemKey: string;
  itemName: string;
  quantity: number;
}

/**
 * Find the inventory item that matches a scanned barcode.
 * Matches on SKU first, then productId.
 * Returns null when no match is found.
 */
export function findInventoryScanMatch(barcode: string, items: InventoryItem[]): ScanMatch | null {
  const match = items.find(item => item.sku === barcode || item.productId === barcode);
  if (!match) return null;
  return {
    itemKey: `${match.productId}-${match.variantId || ''}`,
    itemName: match.name,
    quantity: match.quantity,
  };
}
