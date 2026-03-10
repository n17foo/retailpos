import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';
import { SYLIUS_API_VERSION } from '../../config/apiVersions';
import { SyliusApiClient } from '../../clients/sylius/SyliusApiClient';

/**
 * Sylius-specific inventory service implementation
 */
export class SyliusInventoryService extends BaseInventoryService {
  private apiClient = SyliusApiClient.getInstance();
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiUrl'],
      optional: ['apiKey', 'apiSecret', 'accessToken', 'apiVersion'],
    };
  }

  async initialize(config?: PlatformInventoryConfig): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      this.config.apiUrl = this.config.apiUrl || process.env.SYLIUS_API_URL || '';
      this.config.apiKey = this.config.apiKey || process.env.SYLIUS_API_KEY || '';
      this.config.apiSecret = this.config.apiSecret || process.env.SYLIUS_API_SECRET || '';
      this.config.accessToken = this.config.accessToken || process.env.SYLIUS_ACCESS_TOKEN || '';
      this.config.apiVersion = this.config.apiVersion || process.env.SYLIUS_API_VERSION || SYLIUS_API_VERSION;

      if (!this.config.apiUrl) {
        this.logger.warn({ message: 'Missing Sylius API URL configuration' });
        return false;
      }

      // Configure and initialize the shared Sylius client
      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.apiUrl as string,
          accessToken: this.config.accessToken as string,
          apiVersion: this.config.apiVersion as string,
        });
        await this.apiClient.initialize();
      }

      // Get OAuth token if needed
      if (!this.config.accessToken && this.config.apiKey && this.config.apiSecret) {
        const token = await this.getOAuthToken();
        if (!token) {
          this.logger.error({ message: 'Failed to authenticate with Sylius' });
          return false;
        }
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Sylius inventory service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async getInventory(productIds: string[]): Promise<InventoryResult> {
    if (!this.isInitialized()) {
      throw new Error('Sylius inventory service not initialized');
    }

    const items: InventoryResult['items'] = [];

    try {
      for (const productId of productIds) {
        try {
          // Get product variants to get inventory
          const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/products/${productId}`;
          const response = await fetch(apiUrl, {
            headers: this.getAuthHeaders(),
          });

          if (response.ok) {
            const product = await response.json();

            // Get inventory from variants
            for (const variant of product.variants || []) {
              items.push({
                productId,
                variantId: variant.code || String(variant.id),
                sku: variant.code,
                quantity: variant.onHand || 0,
              });
            }

            // If no variants, add product-level inventory
            if (!product.variants || product.variants.length === 0) {
              items.push({
                productId,
                variantId: productId,
                sku: product.code,
                quantity: product.onHand || 0,
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
      this.logger.error({ message: 'Error fetching inventory from Sylius:' }, error instanceof Error ? error : new Error(String(error)));
      return { items };
    }
  }

  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    if (!this.isInitialized()) {
      throw new Error('Sylius inventory service not initialized');
    }

    const result: InventoryUpdateResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        const variantCode = update.variantId || update.productId;
        const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/product-variants/${variantCode}`;

        // Get current inventory if adjustment
        let newQuantity = update.quantity;
        if (update.adjustment === true) {
          const currentResponse = await fetch(apiUrl, {
            headers: this.getAuthHeaders(),
          });
          if (currentResponse.ok) {
            const current = await currentResponse.json();
            newQuantity = (current.onHand || 0) + update.quantity;
          }
        }

        const response = await fetch(apiUrl, {
          method: 'PATCH',
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'application/merge-patch+json',
          },
          body: JSON.stringify({
            onHand: newQuantity,
            tracked: true,
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

  private async getOAuthToken(): Promise<string | null> {
    if (this.accessToken && this.tokenExpiration && this.tokenExpiration > new Date()) {
      return this.accessToken;
    }

    try {
      const apiUrl = `${this.config.apiUrl}/api/oauth/v2/token`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.apiKey as string,
          client_secret: this.config.apiSecret as string,
        }).toString(),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiration = new Date(Date.now() + (data.expires_in || 3600) * 1000);

      return this.accessToken;
    } catch (error) {
      this.logger.error({ message: 'Error getting Sylius OAuth token' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return this.apiClient['buildHeaders']();
  }
}
