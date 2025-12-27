import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';
import { SHOPIFY_API_VERSION } from '../../config/ServiceConfigBridge';

/**
 * Shopify-specific inventory service implementation
 * Handles Shopify inventory API interactions
 */
export class ShopifyInventoryService extends BaseInventoryService {
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
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const items: InventoryResult['items'] = [];

      // Fetch inventory levels for each product
      for (const productId of productIds) {
        const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/products/${productId}/variants.json`;

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch Shopify inventory: ${response.statusText}`);
        }

        const data = await response.json();

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
      console.error('Error fetching Shopify inventory:', error);
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
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;

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

        // Determine if we're adjusting or setting inventory
        let endpoint, method, body;

        if (update.adjustment) {
          // Adjust inventory
          endpoint = `${this.config.storeUrl}/admin/api/${apiVersion}/inventory_levels/adjust.json`;
          method = 'POST';
          body = {
            inventory_item_id: inventoryItemId,
            location_id: locationId,
            available_adjustment: update.quantity,
          };
        } else {
          // Set inventory
          endpoint = `${this.config.storeUrl}/admin/api/${apiVersion}/inventory_levels/set.json`;
          method = 'POST';
          body = {
            inventory_item_id: inventoryItemId,
            location_id: locationId,
            available: update.quantity,
          };
        }

        const response = await fetch(endpoint, {
          method: method,
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          result.successful++;
        } else {
          result.failed++;
          result.errors.push({
            productId: update.productId,
            variantId: update.variantId,
            error: `Failed to update inventory: ${response.statusText}`,
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error updating Shopify inventory:', error);
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
   * Create authorization headers for Shopify API
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      'X-Shopify-Access-Token': this.config.accessToken || '',
      Accept: 'application/json',
    };
  }

  /**
   * Get the inventory item ID for a variant
   */
  private async getInventoryItemId(variantId: string): Promise<string | null> {
    try {
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/variants/${variantId}.json`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.variant?.inventory_item_id?.toString() || null;
    } catch (error) {
      console.error(`Error getting inventory item ID for variant ${variantId}:`, error);
      return null;
    }
  }

  /**
   * Get the first location ID for inventory adjustments
   */
  private async getFirstLocationId(): Promise<string | null> {
    try {
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/locations.json`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      // Get the first active location
      const location = data.locations?.find((loc: any) => loc.active);
      return location?.id?.toString() || null;
    } catch (error) {
      console.error('Error getting location ID:', error);
      return null;
    }
  }
}
