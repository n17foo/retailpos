import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';
import { MAGENTO_API_VERSION } from '../../config/ServiceConfigBridge';

/**
 * Magento-specific inventory service implementation
 * Supports Magento 2.x REST API with MSI (Multi-Source Inventory) support
 */
export class MagentoInventoryService extends BaseInventoryService {
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;

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
      this.config.apiVersion = this.config.apiVersion || process.env.MAGENTO_API_VERSION || MAGENTO_API_VERSION;
      this.config.sourceCode = this.config.sourceCode || process.env.MAGENTO_SOURCE_CODE || 'default';

      // Normalize store URL
      if (this.config.storeUrl) {
        this.config.storeUrl = this.normalizeStoreUrl(this.config.storeUrl);
      }

      if (!this.config.storeUrl) {
        console.warn('Missing Magento store URL configuration');
        return false;
      }

      // Get auth token if needed
      if (!this.config.accessToken && this.config.username && this.config.password) {
        const token = await this.getAuthToken();
        if (!token) {
          console.error('Failed to authenticate with Magento');
          return false;
        }
      }

      // Test connection
      try {
        const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/stockItems`;
        const response = await fetch(`${apiUrl}?searchCriteria[pageSize]=1`, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok || response.status === 404) {
          // 404 is OK - just means no stock items yet
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to Magento API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to Magento API', error);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize Magento inventory service', error);
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
          const productUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/products/${productId}`;
          const productResponse = await fetch(productUrl, {
            headers: this.getAuthHeaders(),
          });

          if (!productResponse.ok) {
            continue;
          }

          const product = await productResponse.json();
          const sku = product.sku;

          // Get stock item for this SKU
          const stockUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/stockItems/${sku}`;
          const stockResponse = await fetch(stockUrl, {
            headers: this.getAuthHeaders(),
          });

          if (stockResponse.ok) {
            const stockItem = await stockResponse.json();
            items.push({
              productId,
              variantId: productId,
              sku,
              quantity: stockItem.qty || 0,
            });
          } else {
            // Try MSI (Multi-Source Inventory) endpoint
            const sourceUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/inventory/source-items?searchCriteria[filter_groups][0][filters][0][field]=sku&searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(sku)}`;
            const sourceResponse = await fetch(sourceUrl, {
              headers: this.getAuthHeaders(),
            });

            if (sourceResponse.ok) {
              const sourceData = await sourceResponse.json();
              const sourceItem =
                sourceData.items?.find((item: any) => item.source_code === this.config.sourceCode) || sourceData.items?.[0];

              if (sourceItem) {
                items.push({
                  productId,
                  variantId: productId,
                  sku,
                  quantity: sourceItem.quantity || 0,
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching inventory for product ${productId}:`, error);
        }
      }

      return { items };
    } catch (error) {
      console.error('Error fetching inventory from Magento:', error);
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

        // Try to update using standard stock item endpoint
        const stockUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/products/${encodeURIComponent(sku)}/stockItems/1`;

        const newQuantity = update.adjustment === true ? (await this.getCurrentQuantity(sku)) + update.quantity : update.quantity;

        const response = await fetch(stockUrl, {
          method: 'PUT',
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stockItem: {
              qty: newQuantity,
              is_in_stock: newQuantity > 0,
            },
          }),
        });

        if (response.ok) {
          result.successful++;
        } else {
          // Try MSI endpoint
          const msiUpdated = await this.updateMsiInventory(sku, newQuantity);
          if (msiUpdated) {
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

  /**
   * Update inventory using MSI (Multi-Source Inventory)
   */
  private async updateMsiInventory(sku: string, quantity: number): Promise<boolean> {
    try {
      const sourceCode = this.config.sourceCode || 'default';
      const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/inventory/source-items`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceItems: [
            {
              sku,
              source_code: sourceCode,
              quantity,
              status: quantity > 0 ? 1 : 0,
            },
          ],
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error updating MSI inventory:', error);
      return false;
    }
  }

  /**
   * Get current quantity for a SKU
   */
  private async getCurrentQuantity(sku: string): Promise<number> {
    try {
      const stockUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/stockItems/${encodeURIComponent(sku)}`;
      const response = await fetch(stockUrl, {
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        return data.qty || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get admin authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    if (this.accessToken && this.tokenExpiration && this.tokenExpiration > new Date()) {
      return this.accessToken;
    }

    try {
      const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/integration/admin/token`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const token = await response.json();
      this.accessToken = token;
      this.tokenExpiration = new Date(Date.now() + 4 * 60 * 60 * 1000);

      return token;
    } catch (error) {
      console.error('Error getting Magento auth token', error);
      return null;
    }
  }

  /**
   * Get authorization headers
   */
  protected getAuthHeaders(): Record<string, string> {
    const token = this.config.accessToken || this.accessToken || '';
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Normalize store URL
   */
  private normalizeStoreUrl(url: string): string {
    if (!url) return '';
    url = url.replace(/\/$/, '');
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  }
}
