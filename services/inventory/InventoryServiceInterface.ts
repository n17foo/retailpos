/**
 * Result of an inventory query
 */
export interface InventoryResult {
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    sku?: string;
    updatedAt?: Date;
  }>;
}

/**
 * Represents an inventory update
 */
export interface InventoryUpdate {
  productId: string;
  variantId?: string;
  quantity: number;
  adjustment?: boolean; // If true, quantity is an adjustment (+/-), otherwise it's an absolute value
}

/**
 * Result of an inventory update operation
 */
export interface InventoryUpdateResult {
  successful: number;
  failed: number;
  errors: Array<{
    productId: string;
    variantId?: string;
    error: string;
  }>;
}

/**
 * Interface for inventory-related operations in an e-commerce platform
 */
export interface InventoryServiceInterface {
  /**
   * Get inventory levels for products
   * @param productIds Array of product IDs to get inventory for
   * @returns Promise resolving to inventory information
   */
  getInventory(productIds: string[]): Promise<InventoryResult>;

  /**
   * Update inventory levels for products
   * @param updates Inventory updates to apply
   * @returns Promise resolving to the results of the update
   */
  updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult>;
}
