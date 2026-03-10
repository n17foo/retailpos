/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';
import { PrestaShopApiClient } from '../../clients/prestashop/PrestaShopApiClient';

/**
 * PrestaShop-specific inventory service implementation
 */
export class PrestaShopInventoryService extends BaseInventoryService {
  private apiClient = PrestaShopApiClient.getInstance();
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey'],
      optional: [],
    };
  }

  async initialize(config?: PlatformInventoryConfig): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      this.config.storeUrl = this.config.storeUrl || process.env.PRESTASHOP_STORE_URL || '';
      this.config.apiKey = this.config.apiKey || process.env.PRESTASHOP_API_KEY || '';

      if (!this.config.storeUrl || !this.config.apiKey) {
        this.logger.warn({ message: 'Missing PrestaShop API configuration' });
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.storeUrl as string,
          apiKey: this.config.apiKey as string,
        });
        await this.apiClient.initialize();
      }
      this.config.storeUrl = this.apiClient.getBaseUrl();

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize PrestaShop inventory service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async getInventory(productIds: string[]): Promise<InventoryResult> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop inventory service not initialized');
    }

    const items: InventoryResult['items'] = [];

    try {
      for (const productId of productIds) {
        try {
          const apiUrl = `${this.config.storeUrl}/api/stock_availables?output_format=JSON&filter[id_product]=${productId}&display=full`;
          const response = await fetch(apiUrl, {
            headers: this.getAuthHeaders(),
          });

          if (response.ok) {
            const data = await response.json();
            const stockItems = data.stock_availables || [];

            for (const stockItem of stockItems) {
              items.push({
                productId,
                variantId: stockItem.id_product_attribute ? String(stockItem.id_product_attribute) : productId,
                sku: stockItem.reference,
                quantity: parseInt(stockItem.quantity || '0', 10),
              });
            }

            // If no stock items found, add default
            if (stockItems.length === 0) {
              items.push({
                productId,
                variantId: productId,
                quantity: 0,
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
      this.logger.error(
        { message: 'Error fetching inventory from PrestaShop:' },
        error instanceof Error ? error : new Error(String(error))
      );
      return { items };
    }
  }

  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop inventory service not initialized');
    }

    const result: InventoryUpdateResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        // First get the stock_available ID
        const searchUrl = `${this.config.storeUrl}/api/stock_availables?output_format=JSON&filter[id_product]=${update.productId}&display=full`;
        const searchResponse = await fetch(searchUrl, {
          headers: this.getAuthHeaders(),
        });

        if (!searchResponse.ok) {
          throw new Error('Failed to find stock record');
        }

        const searchData = await searchResponse.json();
        const stockItems = searchData.stock_availables || [];

        // Find the right stock item (by variant or default)
        let stockItem =
          stockItems.find((s: any) => (update.variantId ? String(s.id_product_attribute) === update.variantId : !s.id_product_attribute)) ||
          stockItems[0];

        if (!stockItem) {
          throw new Error('Stock record not found');
        }

        // Calculate new quantity
        let newQuantity = update.quantity;
        if (update.adjustment === true) {
          newQuantity = parseInt(stockItem.quantity || '0', 10) + update.quantity;
        }

        // Update the stock
        const updateUrl = `${this.config.storeUrl}/api/stock_availables/${stockItem.id}?output_format=JSON`;
        const response = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stock_available: {
              id: stockItem.id,
              id_product: update.productId,
              id_product_attribute: update.variantId || 0,
              quantity: newQuantity,
            },
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
    return this.apiClient['buildHeaders']();
  }
}
