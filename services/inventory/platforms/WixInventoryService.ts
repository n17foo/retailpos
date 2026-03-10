import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';
import { WIX_API_VERSION } from '../../config/apiVersions';
import { WixApiClient } from '../../clients/wix/WixApiClient';

/**
 * Wix-specific inventory service implementation
 * Uses Wix Stores Inventory API
 */
export class WixInventoryService extends BaseInventoryService {
  private apiClient = WixApiClient.getInstance();
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiKey', 'siteId'],
      optional: ['accountId', 'apiVersion'],
    };
  }

  async initialize(config?: PlatformInventoryConfig): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      this.config.apiKey = this.config.apiKey || process.env.WIX_API_KEY || '';
      this.config.siteId = this.config.siteId || process.env.WIX_SITE_ID || '';
      this.config.accountId = this.config.accountId || process.env.WIX_ACCOUNT_ID || '';
      this.config.apiVersion = this.config.apiVersion || process.env.WIX_API_VERSION || WIX_API_VERSION;

      if (!this.config.apiKey || !this.config.siteId) {
        this.logger.warn({ message: 'Missing Wix API configuration' });
        return false;
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Wix inventory service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async getInventory(productIds: string[]): Promise<InventoryResult> {
    if (!this.isInitialized()) {
      throw new Error('Wix inventory service not initialized');
    }

    const items: InventoryResult['items'] = [];

    try {
      for (const productId of productIds) {
        try {
          // Get product to retrieve inventory
          const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/products/${productId}`;
          const response = await fetch(apiUrl, {
            headers: this.getAuthHeaders(),
          });

          if (response.ok) {
            const data = await response.json();
            const product = data.product;

            // Get inventory from variants or product level
            if (product.variants && product.variants.length > 0) {
              for (const variant of product.variants) {
                items.push({
                  productId,
                  variantId: variant.id,
                  sku: variant.variant?.sku || variant.sku,
                  quantity: variant.stock?.quantity || 0,
                });
              }
            } else {
              items.push({
                productId,
                variantId: productId,
                sku: product.sku,
                quantity: product.stock?.quantity || 0,
              });
            }
          }
        } catch (error) {
          this.logger.error(
            { message: `Error fetching inventory for product ${productId}:` },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      return { items };
    } catch (error) {
      this.logger.error({ message: 'Error fetching inventory from Wix:' }, error instanceof Error ? error : new Error(String(error)));
      return { items };
    }
  }

  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    if (!this.isInitialized()) {
      throw new Error('Wix inventory service not initialized');
    }

    const result: InventoryUpdateResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        // Wix uses the inventory API for updates
        const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/inventoryItems/${update.variantId || update.productId}`;

        // Get current quantity if adjustment
        let newQuantity = update.quantity;
        if (update.adjustment === true) {
          const currentResponse = await fetch(apiUrl, {
            headers: this.getAuthHeaders(),
          });
          if (currentResponse.ok) {
            const current = await currentResponse.json();
            newQuantity = (current.inventoryItem?.quantity || 0) + update.quantity;
          }
        }

        const response = await fetch(`${apiUrl}/updateQuantity`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            inventoryItem: {
              trackQuantity: true,
              quantity: newQuantity,
              inStock: newQuantity > 0,
            },
          }),
        });

        if (response.ok) {
          result.successful++;
        } else {
          // Try alternative product update endpoint
          const productUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/products/${update.productId}`;
          const productResponse = await fetch(productUrl, {
            method: 'PATCH',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
              product: {
                stock: {
                  trackInventory: true,
                  quantity: newQuantity,
                  inStock: newQuantity > 0,
                },
              },
            }),
          });

          if (productResponse.ok) {
            result.successful++;
          } else {
            result.failed++;
            result.errors.push({
              productId: update.productId,
              error: `Failed to update inventory: ${response.statusText}`,
            });
          }
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          productId: update.productId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  protected getAuthHeaders(): Record<string, string> {
    return this.apiClient['buildHeaders']();
  }
}
