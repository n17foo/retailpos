/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';
import { ShopifyApiClient } from '../../clients/shopify/ShopifyApiClient';

/**
 * Shopify-specific inventory service implementation
 * Handles Shopify inventory API interactions
 */
export class ShopifyInventoryService extends BaseInventoryService {
  private apiClient = ShopifyApiClient.getInstance();

  /**
   * Configuration requirements for Shopify
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'accessToken'],
      optional: ['apiVersion'],
    };
  }

  /**
   * Get inventory levels for products from Shopify
   */
  async getInventory(productIds: string[]): Promise<InventoryResult> {
    if (!this.isInitialized()) {
      throw new Error('Shopify inventory service not initialized');
    }

    try {
      const items: InventoryResult['items'] = [];

      for (const productId of productIds) {
        const data = await this.apiClient.get<{ variants: any[] }>(`products/${productId}/variants.json`);

        // Map Shopify variants to inventory items
        if (data.variants && Array.isArray(data.variants)) {
          for (const variant of data.variants) {
            items.push({
              productId: productId,
              variantId: variant.id.toString(),
              quantity: variant.inventory_quantity || 0,
              sku: variant.sku,
              updatedAt: new Date(variant.updated_at),
            });
          }
        }
      }

      return { items };
    } catch (error) {
      this.logger.error({ message: 'Error fetching Shopify inventory' }, error instanceof Error ? error : new Error(String(error)));
      return { items: [] };
    }
  }

  /**
   * Update inventory levels in Shopify
   */
  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    if (!this.isInitialized()) {
      throw new Error('Shopify inventory service not initialized');
    }

    const result: InventoryUpdateResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      for (const update of updates) {
        if (!update.variantId) {
          result.failed++;
          result.errors.push({
            productId: update.productId,
            error: 'Variant ID is required for Shopify inventory updates',
          });
          continue;
        }

        // For Shopify, we need to use the inventory_level endpoints to adjust inventory
        const inventoryItemId = await this.getInventoryItemId(update.variantId);
        if (!inventoryItemId) {
          result.failed++;
          result.errors.push({
            productId: update.productId,
            variantId: update.variantId,
            error: 'Could not find inventory item ID for variant',
          });
          continue;
        }

        const locationId = await this.getFirstLocationId();
        if (!locationId) {
          result.failed++;
          result.errors.push({
            productId: update.productId,
            variantId: update.variantId,
            error: 'Could not find location ID for inventory adjustment',
          });
          continue;
        }

        if (update.adjustment) {
          await this.apiClient.post('inventory_levels/adjust.json', {
            inventory_item_id: inventoryItemId,
            location_id: locationId,
            available_adjustment: update.quantity,
          });
        } else {
          await this.apiClient.post('inventory_levels/set.json', {
            inventory_item_id: inventoryItemId,
            location_id: locationId,
            available: update.quantity,
          });
        }
        result.successful++;
      }

      return result;
    } catch (error) {
      this.logger.error({ message: 'Error updating Shopify inventory' }, error instanceof Error ? error : new Error(String(error)));
      return {
        successful: result.successful,
        failed: updates.length - result.successful,
        errors: [
          ...result.errors,
          {
            productId: 'general',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }

  /**
   * Get the inventory item ID for a variant
   */
  private async getInventoryItemId(variantId: string): Promise<string | null> {
    try {
      const data = await this.apiClient.get<{ variant: any }>(`variants/${variantId}.json`);
      return data.variant?.inventory_item_id?.toString() || null;
    } catch (error) {
      this.logger.error(
        { message: `Error getting inventory item ID for variant ${variantId}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Get the first location ID for inventory adjustments
   */
  private async getFirstLocationId(): Promise<string | null> {
    try {
      const data = await this.apiClient.get<{ locations: any[] }>('locations.json');
      const location = data.locations?.find((loc: any) => loc.active);
      return location?.id?.toString() || null;
    } catch (error) {
      this.logger.error({ message: 'Error getting location ID' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }
}
