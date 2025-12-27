import { SyncDirection, SyncEntityType, SyncError, SyncOperationResult, SyncOptions } from '../SyncServiceInterface';
import { BasePlatformSyncService } from './BasePlatformSyncService';
import { PlatformSyncConfigRequirements } from './PlatformSyncServiceInterface';

import { ProductServiceFactory } from '../../product/productServiceFactory';
import { InventoryServiceFactory } from '../../inventory/inventoryServiceFactory';
import { CategoryServiceFactory } from '../../category/categoryServiceFactory';
import { OrderServiceFactory } from '../../order/orderServiceFactory';
import { ECommercePlatform } from '../../../utils/platforms';
import { SHOPIFY_API_VERSION } from '../../config/ServiceConfigBridge';

/**
 * Shopify-specific sync service implementation
 */
export class ShopifySyncService extends BasePlatformSyncService {
  private webhookIds: string[] = [];
  private storeUrl: string = '';
  private accessToken: string = '';
  private apiVersion: string = SHOPIFY_API_VERSION;

  private getShopifyApiUrl(endpoint: string): string {
    return `${this.storeUrl}/admin/api/${this.apiVersion}/${endpoint}`;
  }

  /**
   * Get configuration requirements for Shopify
   */
  getConfigRequirements(): PlatformSyncConfigRequirements {
    return {
      required: ['storeUrl', 'accessToken'],
      optional: ['apiVersion', 'webhookUrl', 'batchSize'],
    };
  }

  /**
   * Initialize the Shopify sync service
   */
  async initialize(config: Record<string, any>): Promise<boolean> {
    if (!config.storeUrl || !config.accessToken) {
      console.error('Shopify storeUrl and accessToken are required');
      return false;
    }
    this.storeUrl = config.storeUrl;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion || this.apiVersion;

    // Call base class initialization
    const baseInitialized = await super.initialize(config);
    if (!baseInitialized) {
      return false;
    }

    this.initialized = true;
    return true;
  }

  /**
   * Test connection to Shopify API
   */
  async testConnection(): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      // Make a simple API call to test the connection
      const url = this.getShopifyApiUrl('shop.json');
      const headers = {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      };

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error('Shopify connection test failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      return !!data.shop;
    } catch (error) {
      console.error('Error testing Shopify connection:', error);
      return false;
    }
  }

  /**
   * Register webhooks for real-time sync
   */
  async registerSyncWebhooks(webhookUrl: string): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      // Define webhook topics based on entity types
      const webhookTopics = [
        // Product webhooks
        'products/create',
        'products/update',
        'products/delete',
        // Inventory webhooks
        'inventory_levels/update',
        // Order webhooks
        'orders/create',
        'orders/updated',
        'orders/cancelled',
        'orders/fulfilled',
        'orders/paid',
        // Collection (category) webhooks
        'collections/create',
        'collections/update',
        'collections/delete',
        // Customer webhooks if needed
        'customers/create',
        'customers/update',
        'customers/delete',
      ];

      // Register each webhook
      const results = await Promise.all(
        webhookTopics.map(async topic => {
          try {
            const url = this.getShopifyApiUrl('webhooks.json');
            const headers = {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': this.accessToken,
            };

            const response = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                webhook: {
                  topic,
                  address: webhookUrl,
                  format: 'json',
                },
              }),
            });

            if (!response.ok) {
              console.error(`Failed to register Shopify webhook for ${topic}:`, response.statusText);
              return null;
            }

            const data = await response.json();
            return data.webhook?.id;
          } catch (error) {
            console.error(`Error registering Shopify webhook for ${topic}:`, error);
            return null;
          }
        })
      );

      // Store successful webhook IDs
      this.webhookIds = results.filter(Boolean) as string[];

      return this.webhookIds.length > 0;
    } catch (error) {
      console.error('Error registering Shopify webhooks:', error);
      return false;
    }
  }

  /**
   * Unregister previously registered webhooks
   */
  async unregisterSyncWebhooks(): Promise<boolean> {
    if (!this.isInitialized() || this.webhookIds.length === 0) {
      return false;
    }

    try {
      // Delete each registered webhook
      const results = await Promise.all(
        this.webhookIds.map(async webhookId => {
          try {
            const url = this.getShopifyApiUrl(`webhooks/${webhookId}.json`);
            const headers = {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': this.accessToken,
            };

            const response = await fetch(url, {
              method: 'DELETE',
              headers,
            });

            return response.ok;
          } catch (error) {
            console.error(`Error unregistering Shopify webhook ${webhookId}:`, error);
            return false;
          }
        })
      );

      // Clear webhook IDs
      this.webhookIds = [];

      // Return true if all webhooks were successfully deleted
      return results.every(Boolean);
    } catch (error) {
      console.error('Error unregistering Shopify webhooks:', error);
      return false;
    }
  }

  /**
   * Execute a sync operation against Shopify
   */
  protected async executeSyncOperation(syncId: string, options: SyncOptions): Promise<void> {
    if (!this.isInitialized()) {
      throw new Error('Shopify sync service not initialized');
    }

    const startTime = new Date();
    let entityCount = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    const errors: SyncError[] = [];
    const warnings: string[] = [];

    try {
      // Get appropriate services based on entity type
      switch (options.entityType) {
        case SyncEntityType.PRODUCT:
          await this.syncProducts(syncId, options, { successful, failed, skipped, errors, warnings, entityCount });
          break;

        case SyncEntityType.INVENTORY:
          await this.syncInventory(syncId, options, { successful, failed, skipped, errors, warnings, entityCount });
          break;

        case SyncEntityType.CATEGORY:
          await this.syncCategories(syncId, options, { successful, failed, skipped, errors, warnings, entityCount });
          break;

        case SyncEntityType.ORDER:
          await this.syncOrders(syncId, options, { successful, failed, skipped, errors, warnings, entityCount });
          break;

        case SyncEntityType.ALL:
          // Sync all entity types
          await this.syncProducts(
            syncId,
            { ...options, entityType: SyncEntityType.PRODUCT },
            { successful, failed, skipped, errors, warnings, entityCount }
          );

          await this.syncInventory(
            syncId,
            { ...options, entityType: SyncEntityType.INVENTORY },
            { successful, failed, skipped, errors, warnings, entityCount }
          );

          await this.syncCategories(
            syncId,
            { ...options, entityType: SyncEntityType.CATEGORY },
            { successful, failed, skipped, errors, warnings, entityCount }
          );

          await this.syncOrders(
            syncId,
            { ...options, entityType: SyncEntityType.ORDER },
            { successful, failed, skipped, errors, warnings, entityCount }
          );
          break;

        default:
          warnings.push(`Entity type ${options.entityType} not supported for Shopify sync`);
      }

      // Complete the sync operation
      const endTime = new Date();
      const result: SyncOperationResult = {
        entityType: options.entityType,
        successful,
        failed,
        skipped,
        errors,
        warnings,
        completedAt: endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };

      this.completeSyncOperation(syncId, result);
    } catch (error) {
      console.error(`Error in Shopify sync operation ${syncId}:`, error);
      throw error;
    }
  }

  /**
   * Sync products between POS and Shopify
   */
  private async syncProducts(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const productService = ProductServiceFactory.getInstance().getService(ECommercePlatform.SHOPIFY);

    try {
      if (options.direction === SyncDirection.POS_TO_ECOMMERCE) {
        // Get products from database or another source
        // For now, we'll assume products are passed in entityIds
        if (!options.entityIds || options.entityIds.length === 0) {
          stats.warnings.push('No product IDs specified for sync');
          return;
        }

        // Update progress total
        stats.entityCount += options.entityIds.length;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // TODO: In a real implementation, we would fetch products from database
        // const products = await getProductsFromDatabase(options.entityIds);

        // For now, just simulate some progress
        for (let i = 0; i < options.entityIds.length; i++) {
          if (options.dryRun) {
            stats.skipped++;
          } else {
            try {
              // In a real implementation, sync each product to Shopify
              // await productService.syncProducts([products[i]]);
              stats.successful++;
            } catch (error) {
              stats.failed++;
              stats.errors.push({
                entityId: options.entityIds[i],
                message: `Failed to sync product: ${error.message || 'Unknown error'}`,
                details: error,
              });
            }
          }

          // Update progress
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);
        }
      } else if (options.direction === SyncDirection.ECOMMERCE_TO_POS) {
        // Fetch products from Shopify
        const result = await productService.getProducts({ limit: options.batchSize || 50 });

        // Update progress total
        stats.entityCount += result.products.length;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // Process each product
        for (let i = 0; i < result.products.length; i++) {
          const product = result.products[i];

          if (options.dryRun) {
            stats.skipped++;
          } else {
            try {
              // In a real implementation, sync product to POS
              // await syncProductToPOS(product);
              stats.successful++;
            } catch (error) {
              stats.failed++;
              stats.errors.push({
                entityId: product.id,
                message: `Failed to sync product to POS: ${error.message || 'Unknown error'}`,
                details: error,
              });
            }
          }

          // Update progress
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);
        }
      }
    } catch (error) {
      stats.warnings.push(`Error in product sync: ${error.message}`);
    }
  }

  /**
   * Sync inventory between POS and Shopify
   */
  private async syncInventory(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const inventoryService = InventoryServiceFactory.getInstance().getService(ECommercePlatform.SHOPIFY);

    try {
      if (options.direction === SyncDirection.POS_TO_ECOMMERCE) {
        // Similar implementation to products sync
        if (!options.entityIds || options.entityIds.length === 0) {
          stats.warnings.push('No inventory IDs specified for sync');
          return;
        }

        // Update progress total
        stats.entityCount += options.entityIds.length;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // Process inventory updates
        for (let i = 0; i < options.entityIds.length; i++) {
          // Simulate sync operations
          stats.successful++;
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);
        }
      } else {
        // Simulate fetching inventory from Shopify
        const inventoryCount = 25;
        stats.entityCount += inventoryCount;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // Simulate processing
        for (let i = 0; i < inventoryCount; i++) {
          stats.successful++;
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);

          // Simulate some processing delay
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      stats.warnings.push(`Error in inventory sync: ${error.message}`);
    }
  }

  /**
   * Sync categories between POS and Shopify
   */
  private async syncCategories(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const categoryService = CategoryServiceFactory.getInstance().getService(ECommercePlatform.SHOPIFY);

    try {
      // Similar implementation to products sync
      if (options.direction === SyncDirection.ECOMMERCE_TO_POS) {
        const categories = await categoryService.getCategories();

        // Update progress total
        stats.entityCount += categories.length;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        for (let i = 0; i < categories.length; i++) {
          // Simulate sync operations
          stats.successful++;
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);

          // Simulate some processing delay
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } else {
        // Implement POS to Shopify sync
        stats.warnings.push('Category sync from POS to Shopify not yet implemented');
      }
    } catch (error) {
      stats.warnings.push(`Error in category sync: ${error.message}`);
    }
  }

  /**
   * Sync orders between POS and Shopify
   */
  private async syncOrders(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const orderService = OrderServiceFactory.getInstance().getService(ECommercePlatform.SHOPIFY);

    try {
      // Similar implementation to products sync
      if (options.direction === SyncDirection.ECOMMERCE_TO_POS) {
        // Simulate fetching orders from Shopify
        const orderCount = 10;
        stats.entityCount += orderCount;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        for (let i = 0; i < orderCount; i++) {
          // Simulate sync operations
          stats.successful++;
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);

          // Simulate some processing delay
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        // Implement POS to Shopify sync
        stats.warnings.push('Order sync from POS to Shopify not yet implemented');
      }
    } catch (error) {
      stats.warnings.push(`Error in order sync: ${error.message}`);
    }
  }
}
