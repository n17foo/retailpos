import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';
import { SquarespaceApiClient } from '../../clients/squarespace/SquarespaceApiClient';

interface SquarespaceInventoryQuantity {
  value?: number;
}

interface SquarespaceInventoryItem {
  productId: string;
  variantId?: string;
  sku?: string;
  quantity?: number | SquarespaceInventoryQuantity;
}

interface SquarespaceInventoryListResponse {
  inventory?: SquarespaceInventoryItem[];
}

interface SquarespaceInventoryDetailResponse {
  quantity?: number | SquarespaceInventoryQuantity;
}

const getSquarespaceQuantityValue = (quantity?: number | SquarespaceInventoryQuantity): number => {
  if (typeof quantity === 'number') {
    return quantity;
  }

  return quantity?.value ?? 0;
};

/**
 * Squarespace Commerce inventory service implementation
 */
export class SquarespaceInventoryService extends BaseInventoryService {
  private apiClient = SquarespaceApiClient.getInstance();
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
      this.config.apiVersion = this.config.apiVersion || process.env.SQUARESPACE_API_VERSION || '';

      if (!this.config.apiKey) {
        this.logger.warn({ message: 'Missing Squarespace API configuration' });
        return false;
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Squarespace inventory service' },
        error instanceof Error ? error : new Error(String(error))
      );
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
      const data = await this.apiClient.get<SquarespaceInventoryListResponse>('inventory');
      const inventoryItems = data.inventory || [];

      // Filter by requested product IDs
      for (const invItem of inventoryItems) {
        if (productIds.includes(invItem.productId)) {
          items.push({
            productId: invItem.productId,
            variantId: invItem.variantId,
            sku: invItem.sku,
            quantity: getSquarespaceQuantityValue(invItem.quantity),
          });
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
      this.logger.error(
        { message: 'Error fetching inventory from Squarespace:' },
        error instanceof Error ? error : new Error(String(error))
      );
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

        let newQuantity = update.quantity;
        if (update.adjustment === true) {
          try {
            const current = await this.apiClient.get<SquarespaceInventoryDetailResponse>(`inventory/${variantId}`);
            newQuantity = getSquarespaceQuantityValue(current.quantity) + update.quantity;
          } catch {
            /* keep update.quantity */
          }
        }

        await this.apiClient.post(`inventory/${variantId}`, { quantity: newQuantity, isUnlimited: false });
        result.successful++;
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
}
