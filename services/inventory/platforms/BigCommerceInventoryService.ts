import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';

/**
 * BigCommerce-specific inventory service implementation
 * Handles BigCommerce inventory API interactions
 */
export class BigCommerceInventoryService extends BaseInventoryService {
  /**
   * Configuration requirements for BigCommerce
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeHash', 'accessToken', 'clientId'],
      optional: [],
    };
  }

  /**
   * Get inventory levels for products from BigCommerce
   */
  async getInventory(productIds: string[]): Promise<InventoryResult> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce inventory service not initialized');
    }

    try {
      const items: InventoryResult['items'] = [];

      // BigCommerce requires us to fetch products one by one
      for (const productId of productIds) {
        const apiUrl = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/catalog/products/${productId}?include=variants`;

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
          console.error(`Failed to fetch BigCommerce product ${productId}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        const product = data.data;

        if (!product) continue;

        // Handle simple products
        if (!product.variants || product.variants.length === 0) {
          items.push({
            productId: product.id.toString(),
            quantity: product.inventory_level || 0,
            sku: product.sku,
            updatedAt: new Date(product.date_modified),
          });
        }
        // Handle products with variants
        else {
          for (const variant of product.variants) {
            items.push({
              productId: product.id.toString(),
              variantId: variant.id.toString(),
              quantity: variant.inventory_level || 0,
              sku: variant.sku,
              updatedAt: new Date(variant.date_modified || product.date_modified),
            });
          }
        }
      }

      return { items };
    } catch (error) {
      console.error('Error fetching BigCommerce inventory:', error);
      return { items: [] };
    }
  }

  /**
   * Update inventory levels in BigCommerce
   */
  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce inventory service not initialized');
    }

    const result: InventoryUpdateResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      for (const update of updates) {
        let apiUrl: string;
        let currentInventory = 0;

        // If this is an adjustment, we need to get the current inventory level first
        if (update.adjustment) {
          const inventory = await this.getInventory([update.productId]);
          const item = inventory.items.find(
            i => i.productId === update.productId && (!update.variantId || i.variantId === update.variantId)
          );

          if (item) {
            currentInventory = item.quantity;
          }
        }

        // Calculate the new inventory level
        const newInventory = update.adjustment
          ? Math.max(0, currentInventory + update.quantity) // Prevent negative inventory
          : update.quantity;

        // Determine if we're updating a variant or main product
        if (update.variantId) {
          apiUrl = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/catalog/products/${update.productId}/variants/${update.variantId}`;

          const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
              ...this.getAuthHeaders(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inventory_level: newInventory,
            }),
          });

          if (response.ok) {
            result.successful++;
          } else {
            result.failed++;
            result.errors.push({
              productId: update.productId,
              variantId: update.variantId,
              error: `Failed to update variant inventory: ${response.statusText}`,
            });
          }
        } else {
          apiUrl = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/catalog/products/${update.productId}`;

          const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
              ...this.getAuthHeaders(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inventory_level: newInventory,
              inventory_tracking: 'product',
            }),
          });

          if (response.ok) {
            result.successful++;
          } else {
            result.failed++;
            result.errors.push({
              productId: update.productId,
              error: `Failed to update product inventory: ${response.statusText}`,
            });
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error updating BigCommerce inventory:', error);
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
   * Create authorization headers for BigCommerce API
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      'X-Auth-Token': this.config.accessToken || '',
      'X-Auth-Client': this.config.clientId || '',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
}
