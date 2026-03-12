import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { PlatformInventoryConfig, PlatformConfigRequirements } from './PlatformInventoryServiceInterface';
import { BaseInventoryService } from './BaseInventoryService';
import { SyliusApiClient } from '../../clients/sylius/SyliusApiClient';

interface SyliusInventoryVariant {
  id?: string | number;
  code?: string;
  onHand?: number;
}

interface SyliusInventoryProduct {
  code?: string;
  onHand?: number;
  variants?: SyliusInventoryVariant[];
}

interface SyliusInventoryVariantDetail {
  onHand?: number;
}

/**
 * Sylius-specific inventory service implementation
 */
export class SyliusInventoryService extends BaseInventoryService {
  private apiClient = SyliusApiClient.getInstance();

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
      this.config.apiVersion = this.config.apiVersion || process.env.SYLIUS_API_VERSION || '';

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
          const product = await this.apiClient.get<SyliusInventoryProduct>(`products/${productId}`);
          for (const variant of product.variants || []) {
            items.push({ productId, variantId: variant.code || String(variant.id), sku: variant.code, quantity: variant.onHand || 0 });
          }
          if (!product.variants || product.variants.length === 0) {
            items.push({ productId, variantId: productId, sku: product.code, quantity: product.onHand || 0 });
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

        let newQuantity = update.quantity;
        if (update.adjustment === true) {
          try {
            const current = await this.apiClient.get<SyliusInventoryVariantDetail>(`product-variants/${variantCode}`);
            newQuantity = (current.onHand || 0) + update.quantity;
          } catch {
            /* keep update.quantity */
          }
        }

        await this.apiClient.put(`product-variants/${variantCode}`, { onHand: newQuantity, tracked: true });
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
