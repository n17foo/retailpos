import { useState, useCallback } from 'react';
import { PlatformServiceRegistry } from '../services/platform/PlatformServiceRegistry';
import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../services/inventory/InventoryServiceInterface';
import { ECommercePlatform } from '../utils/platforms';
import { useLogger } from './useLogger';

/**
 * Hook for inventory operations
 * Provides methods for getting and updating inventory across e-commerce platforms
 */
export const useInventory = (platform?: ECommercePlatform) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryResult | null>(null);
  const logger = useLogger('useInventory');

  const registry = PlatformServiceRegistry.getInstance();

  /**
   * Get inventory for specific product IDs
   */
  const getInventory = useCallback(
    async (productIds: string[]): Promise<InventoryResult | null> => {
      try {
        setIsLoading(true);
        setError(null);

        const service = registry.getInventoryService(platform || ECommercePlatform.OFFLINE);
        const result = await service.getInventory(productIds);
        setInventory(result);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch inventory';
        setError(errorMessage);
        logger.error({ message: 'Error fetching inventory' }, err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [registry, platform]
  );

  /**
   * Update inventory for products
   */
  const updateInventory = useCallback(
    async (updates: InventoryUpdate[]): Promise<InventoryUpdateResult | null> => {
      try {
        setIsLoading(true);
        setError(null);

        const service = registry.getInventoryService(platform || ECommercePlatform.OFFLINE);
        const result = await service.updateInventory(updates);

        if (result.failed > 0) {
          setError(`${result.failed} inventory updates failed`);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update inventory';
        setError(errorMessage);
        logger.error({ message: 'Error updating inventory' }, err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [registry, platform]
  );

  /**
   * Adjust inventory quantity (increment/decrement)
   */
  const adjustInventory = useCallback(
    async (productId: string, adjustment: number, variantId?: string): Promise<boolean> => {
      const update: InventoryUpdate = {
        productId,
        variantId,
        quantity: adjustment,
        adjustment: true, // This is an adjustment, not absolute value
      };

      const result = await updateInventory([update]);
      return result !== null && result.successful > 0;
    },
    [updateInventory]
  );

  /**
   * Set absolute inventory quantity
   */
  const setInventoryQuantity = useCallback(
    async (productId: string, quantity: number, variantId?: string): Promise<boolean> => {
      const update: InventoryUpdate = {
        productId,
        variantId,
        quantity,
        adjustment: false, // This is an absolute value
      };

      const result = await updateInventory([update]);
      return result !== null && result.successful > 0;
    },
    [updateInventory]
  );

  /**
   * Get inventory for a single product
   */
  const getProductInventory = useCallback(
    async (productId: string): Promise<number> => {
      const result = await getInventory([productId]);
      if (result && result.items.length > 0) {
        // Sum up all variant quantities for the product
        return result.items.reduce((total, item) => total + item.quantity, 0);
      }
      return 0;
    },
    [getInventory]
  );

  return {
    isLoading,
    error,
    inventory,
    getInventory,
    updateInventory,
    adjustInventory,
    setInventoryQuantity,
    getProductInventory,
  };
};
