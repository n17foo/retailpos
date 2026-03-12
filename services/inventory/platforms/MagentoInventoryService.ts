/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';
import { MagentoApiClient } from '../../clients/magento/MagentoApiClient';

/**
 * Magento-specific inventory service implementation
 * Supports Magento 2.x REST API with MSI (Multi-Source Inventory) support
 */
export class MagentoInventoryService extends BaseInventoryService {
  private apiClient = MagentoApiClient.getInstance();

  /**
   * Get configuration requirements
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl'],
      optional: ['username', 'password', 'accessToken', 'apiVersion', 'sourceCode'],
    };
  }

  /**
   * Initialize the inventory service
   */
  async initialize(config?: PlatformInventoryConfig): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      // Set up configuration
      this.config.storeUrl = this.config.storeUrl || process.env.MAGENTO_STORE_URL || '';
      this.config.username = this.config.username || process.env.MAGENTO_USERNAME || '';
      this.config.password = this.config.password || process.env.MAGENTO_PASSWORD || '';
      this.config.accessToken = this.config.accessToken || process.env.MAGENTO_ACCESS_TOKEN || '';
      this.config.apiVersion = this.config.apiVersion || process.env.MAGENTO_API_VERSION || '';
      this.config.sourceCode = this.config.sourceCode || process.env.MAGENTO_SOURCE_CODE || 'default';

      if (!this.config.storeUrl) {
        this.logger.warn({ message: 'Missing Magento store URL configuration' });
        return false;
      }

      // Configure and initialize the shared Magento client
      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.storeUrl as string,
          accessToken: this.config.accessToken as string,
          apiVersion: this.config.apiVersion as string,
        });
        await this.apiClient.initialize();
      }
      this.config.storeUrl = this.apiClient.getBaseUrl();

      // Test connection
      try {
        await this.apiClient.get('stockItems', { 'searchCriteria[pageSize]': '1' });
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Magento API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Magento inventory service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Get inventory levels for products
   */
  async getInventory(productIds: string[]): Promise<InventoryResult> {
    if (!this.isInitialized()) {
      throw new Error('Magento inventory service not initialized');
    }

    const items: InventoryResult['items'] = [];

    try {
      for (const productId of productIds) {
        try {
          // First get the product to get its SKU
          let sku: string;
          try {
            const product = await this.apiClient.get<any>(`products/${productId}`);
            sku = product.sku;
          } catch {
            continue;
          }

          // Get stock item for this SKU
          try {
            const stockItem = await this.apiClient.get<any>(`stockItems/${encodeURIComponent(sku)}`);
            items.push({ productId, variantId: productId, sku, quantity: stockItem.qty || 0 });
          } catch {
            // Try MSI (Multi-Source Inventory) endpoint
            const sourceData = await this.apiClient.get<any>(
              `inventory/source-items?searchCriteria[filter_groups][0][filters][0][field]=sku&searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(sku)}`
            );
            const sourceItem = sourceData.items?.find((item: any) => item.source_code === this.config.sourceCode) || sourceData.items?.[0];
            if (sourceItem) {
              items.push({ productId, variantId: productId, sku, quantity: sourceItem.quantity || 0 });
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
      this.logger.error({ message: 'Error fetching inventory from Magento:' }, error instanceof Error ? error : new Error(String(error)));
      return { items };
    }
  }

  /**
   * Update inventory levels
   */
  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    if (!this.isInitialized()) {
      throw new Error('Magento inventory service not initialized');
    }

    const result: InventoryUpdateResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        const sku = update.variantId || update.productId;

        if (!sku) {
          result.failed++;
          result.errors.push({
            productId: update.productId,
            error: 'SKU is required for Magento inventory updates',
          });
          continue;
        }

        const newQuantity = update.adjustment === true ? (await this.getCurrentQuantity(sku)) + update.quantity : update.quantity;

        try {
          await this.apiClient.put(`products/${encodeURIComponent(sku)}/stockItems/1`, {
            stockItem: { qty: newQuantity, is_in_stock: newQuantity > 0 },
          });
          result.successful++;
        } catch {
          // Try MSI endpoint
          const msiUpdated = await this.updateMsiInventory(sku, newQuantity);
          if (msiUpdated) {
            result.successful++;
          } else {
            result.failed++;
            result.errors.push({ productId: update.productId, error: 'Failed to update inventory' });
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

  /**
   * Update inventory using MSI (Multi-Source Inventory)
   */
  private async updateMsiInventory(sku: string, quantity: number): Promise<boolean> {
    try {
      const sourceCode = this.config.sourceCode || 'default';
      await this.apiClient.post('inventory/source-items', {
        sourceItems: [{ sku, source_code: sourceCode, quantity, status: quantity > 0 ? 1 : 0 }],
      });
      return true;
    } catch (error) {
      this.logger.error({ message: 'Error updating MSI inventory:' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get current quantity for a SKU
   */
  private async getCurrentQuantity(sku: string): Promise<number> {
    try {
      const data = await this.apiClient.get<any>(`stockItems/${encodeURIComponent(sku)}`);
      return data.qty || 0;
    } catch {
      return 0;
    }
  }
}
