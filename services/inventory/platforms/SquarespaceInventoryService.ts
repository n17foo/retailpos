import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';

// Squarespace API version
const SQUARESPACE_API_VERSION = '1.0';

/**
 * Squarespace Commerce inventory service implementation
 */
export class SquarespaceInventoryService extends BaseInventoryService {
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiKey'],
      optional: ['siteId', 'apiVersion'],
    };
  }

  async initialize(config?: PlatformInventoryConfig): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      this.config.apiKey = this.config.apiKey || process.env.SQUARESPACE_API_KEY || '';
      this.config.siteId = this.config.siteId || process.env.SQUARESPACE_SITE_ID || '';
      this.config.apiVersion = this.config.apiVersion || process.env.SQUARESPACE_API_VERSION || SQUARESPACE_API_VERSION;

      if (!this.config.apiKey) {
        console.warn('Missing Squarespace API configuration');
        return false;
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Squarespace inventory service', error);
      return false;
    }
  }

  async getInventory(productIds: string[]): Promise<InventoryResult> {
    if (!this.isInitialized()) {
      throw new Error('Squarespace inventory service not initialized');
    }

    const items: InventoryResult['items'] = [];

    try {
      // Squarespace inventory is retrieved through the products API
      const apiUrl = `https://api.squarespace.com/${this.config.apiVersion}/commerce/inventory`;
      const response = await fetch(apiUrl, {
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        const inventoryItems = data.inventory || [];

        // Filter by requested product IDs
        for (const invItem of inventoryItems) {
          if (productIds.includes(invItem.productId)) {
            items.push({
              productId: invItem.productId,
              variantId: invItem.variantId,
              sku: invItem.sku,
              quantity: invItem.quantity?.value ?? invItem.quantity ?? 0,
            });
          }
        }
      }

      // For products not found in inventory response, add with 0 quantity
      for (const productId of productIds) {
        if (!items.find(i => i.productId === productId)) {
          items.push({
            productId,
            variantId: productId,
            quantity: 0,
          });
        }
      }

      return { items };
    } catch (error) {
      console.error('Error fetching inventory from Squarespace:', error);
      return { items };
    }
  }

  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    if (!this.isInitialized()) {
      throw new Error('Squarespace inventory service not initialized');
    }

    const result: InventoryUpdateResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        const variantId = update.variantId || update.productId;
        const apiUrl = `https://api.squarespace.com/${this.config.apiVersion}/commerce/inventory/${variantId}`;

        // Calculate new quantity
        let newQuantity = update.quantity;
        if (update.adjustment === true) {
          // Get current quantity first
          const currentResponse = await fetch(apiUrl, {
            headers: this.getAuthHeaders(),
          });
          if (currentResponse.ok) {
            const current = await currentResponse.json();
            newQuantity = (current.quantity?.value || current.quantity || 0) + update.quantity;
          }
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            quantity: newQuantity,
            isUnlimited: false,
          }),
        });

        if (response.ok) {
          result.successful++;
        } else {
          result.failed++;
          result.errors.push({
            productId: update.productId,
            error: `Failed to update inventory: ${response.statusText}`,
          });
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
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'RetailPOS/1.0',
    };
  }
}
