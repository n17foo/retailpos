import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';

/**
 * WooCommerce-specific inventory service implementation
 * Handles WooCommerce inventory API interactions
 */
export class WooCommerceInventoryService extends BaseInventoryService {
  /**
   * Configuration requirements for WooCommerce
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey', 'apiSecret'],
      optional: [],
    };
  }

  /**
   * Get inventory levels for products from WooCommerce
   */
  async getInventory(productIds: string[]): Promise<InventoryResult> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce inventory service not initialized');
    }

    try {
      const items: InventoryResult['items'] = [];

      // WooCommerce API allows fetching multiple products in one request
      const idsParam = productIds.join(',');
      const apiUrl = `${this.config.storeUrl}/wp-json/wc/v3/products?include=${idsParam}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch WooCommerce inventory: ${response.statusText}`);
      }

      const products = await response.json();

      // Process main products inventory
      for (const product of products) {
        if (product.type === 'simple') {
          // Simple products have direct stock management
          items.push({
            productId: product.id.toString(),
            quantity: product.stock_quantity || 0,
            sku: product.sku,
            updatedAt: new Date(product.date_modified),
          });
        } else if (product.type === 'variable' && product.variations && product.variations.length > 0) {
          // For variable products, we need to fetch each variation's inventory
          const variationsUrl = `${this.config.storeUrl}/wp-json/wc/v3/products/${product.id}/variations`;

          const variationsResponse = await fetch(variationsUrl, {
            method: 'GET',
            headers: this.getAuthHeaders(),
          });

          if (variationsResponse.ok) {
            const variations = await variationsResponse.json();

            for (const variant of variations) {
              items.push({
                productId: product.id.toString(),
                variantId: variant.id.toString(),
                quantity: variant.stock_quantity || 0,
                sku: variant.sku,
                updatedAt: new Date(variant.date_modified),
              });
            }
          }
        }
      }

      return { items };
    } catch (error) {
      console.error('Error fetching WooCommerce inventory:', error);
      return { items: [] };
    }
  }

  /**
   * Update inventory levels in WooCommerce
   */
  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce inventory service not initialized');
    }

    const result: InventoryUpdateResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      for (const update of updates) {
        let apiUrl: string;

        // Determine if we're updating a main product or a variation
        if (update.variantId) {
          apiUrl = `${this.config.storeUrl}/wp-json/wc/v3/products/${update.productId}/variations/${update.variantId}`;
        } else {
          apiUrl = `${this.config.storeUrl}/wp-json/wc/v3/products/${update.productId}`;
        }

        // If this is an adjustment, we need to get the current quantity first
        let newQuantity = update.quantity;

        if (update.adjustment) {
          const currentInventory = await this.getInventory([update.productId]);
          const item = currentInventory.items.find(
            i => i.productId === update.productId && (!update.variantId || i.variantId === update.variantId)
          );

          if (item) {
            newQuantity = (item.quantity || 0) + update.quantity;
            if (newQuantity < 0) newQuantity = 0; // Prevent negative inventory
          }
        }

        // Update the inventory
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stock_quantity: newQuantity,
            manage_stock: true,
          }),
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
      console.error('Error updating WooCommerce inventory:', error);
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
   * Create authorization headers for WooCommerce API
   * WooCommerce uses Basic Authentication
   */
  protected getAuthHeaders(): Record<string, string> {
    const credentials = `${this.config.apiKey}:${this.config.apiSecret}`;
    const encodedCredentials = Buffer.from(credentials).toString('base64');

    return {
      Authorization: `Basic ${encodedCredentials}`,
      Accept: 'application/json',
    };
  }
}
