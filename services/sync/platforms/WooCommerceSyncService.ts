import { SyncDirection, SyncEntityType, SyncError, SyncOperationResult, SyncOptions } from '../SyncServiceInterface';
import { BasePlatformSyncService } from './BasePlatformSyncService';
import { PlatformSyncConfigRequirements } from './PlatformSyncServiceInterface';
import { ProductServiceFactory } from '../../product/productServiceFactory';
import { InventoryServiceFactory } from '../../inventory/inventoryServiceFactory';
import { CategoryServiceFactory } from '../../category/categoryServiceFactory';
import { OrderServiceFactory } from '../../order/orderServiceFactory';
import { ECommercePlatform } from '../../../utils/platforms';
import { Buffer } from 'buffer';

/**
 * WooCommerce-specific sync service implementation
 */
export class WooCommerceSyncService extends BasePlatformSyncService {
  private webhookIds: string[] = [];
  private storeUrl: string = '';
  private apiKey: string = '';
  private apiSecret: string = '';
  private version: string = 'wc/v3';

  private getWooCommerceApiUrl(endpoint: string): string {
    return `${this.storeUrl}/wp-json/${this.version}/${endpoint}`;
  }

  /**
   * Get configuration requirements for WooCommerce
   */
  getConfigRequirements(): PlatformSyncConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey', 'apiSecret'],
      optional: ['webhookUrl', 'batchSize', 'version'],
    };
  }

  /**
   * Initialize the WooCommerce sync service
   */
  async initialize(config: Record<string, any>): Promise<boolean> {
    if (!config.storeUrl || !config.apiKey || !config.apiSecret) {
      console.error('WooCommerce storeUrl, apiKey, and apiSecret are required');
      return false;
    }
    this.storeUrl = config.storeUrl;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.version = config.version || this.version;

    // Call base class initialization
    const baseInitialized = await super.initialize(config);
    if (!baseInitialized) {
      return false;
    }

    this.initialized = true;
    return true;
  }

  /**
   * Test connection to WooCommerce API
   */
  async testConnection(): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      // Create auth header for WooCommerce
      const authString = `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`;

      // Make a simple API call to test the connection
      const url = this.getWooCommerceApiUrl('system_status');

      const response = await fetch(url, {
        headers: {
          Authorization: authString,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('WooCommerce connection test failed:', response.statusText);
        return false;
      }

      // If we get a valid response, the connection is working
      return true;
    } catch (error) {
      console.error('Error testing WooCommerce connection:', error);
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
        { topic: 'product.created', name: 'Product Created' },
        { topic: 'product.updated', name: 'Product Updated' },
        { topic: 'product.deleted', name: 'Product Deleted' },
        // Order webhooks
        { topic: 'order.created', name: 'Order Created' },
        { topic: 'order.updated', name: 'Order Updated' },
        { topic: 'order.deleted', name: 'Order Deleted' },
        // Product category webhooks
        { topic: 'product_cat.created', name: 'Product Category Created' },
        { topic: 'product_cat.updated', name: 'Product Category Updated' },
        { topic: 'product_cat.deleted', name: 'Product Category Deleted' },
      ];

      // Create auth header for WooCommerce
      const authString = `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`;

      // Register each webhook
      const results = await Promise.all(
        webhookTopics.map(async ({ topic, name }) => {
          try {
            const url = this.getWooCommerceApiUrl('webhooks');

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                Authorization: authString,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name,
                topic,
                delivery_url: webhookUrl,
                status: 'active',
              }),
            });

            if (!response.ok) {
              console.error(`Failed to register WooCommerce webhook for ${topic}:`, response.statusText);
              return null;
            }

            const data = await response.json();
            return data.id;
          } catch (error) {
            console.error(`Error registering WooCommerce webhook for ${topic}:`, error);
            return null;
          }
        })
      );

      // Store successful webhook IDs
      this.webhookIds = results.filter(Boolean) as string[];

      return this.webhookIds.length > 0;
    } catch (error) {
      console.error('Error registering WooCommerce webhooks:', error);
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
      // Create auth header for WooCommerce
      const authString = `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`;

      // Delete each registered webhook
      const results = await Promise.all(
        this.webhookIds.map(async webhookId => {
          try {
            const url = this.getWooCommerceApiUrl(`webhooks/${webhookId}`);

            const response = await fetch(url, {
              method: 'DELETE',
              headers: {
                Authorization: authString,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                force: true,
              }),
            });

            return response.ok;
          } catch (error) {
            console.error(`Error unregistering WooCommerce webhook ${webhookId}:`, error);
            return false;
          }
        })
      );

      // Clear webhook IDs
      this.webhookIds = [];

      // Return true if all webhooks were successfully deleted
      return results.every(Boolean);
    } catch (error) {
      console.error('Error unregistering WooCommerce webhooks:', error);
      return false;
    }
  }

  /**
   * Execute a sync operation against WooCommerce
   */
  protected async executeSyncOperation(syncId: string, options: SyncOptions): Promise<void> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce sync service not initialized');
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
          warnings.push(`Entity type ${options.entityType} not supported for WooCommerce sync`);
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
      console.error(`Error in WooCommerce sync operation ${syncId}:`, error);
      throw error;
    }
  }

  /**
   * Sync products between POS and WooCommerce
   */
  private async syncProducts(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const productService = ProductServiceFactory.getInstance().getService(ECommercePlatform.WOOCOMMERCE);

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

        // Process each product
        for (let i = 0; i < options.entityIds.length; i++) {
          if (options.dryRun) {
            stats.skipped++;
          } else {
            try {
              // In a real implementation, sync each product to WooCommerce
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
        // Fetch products from WooCommerce
        // In a real implementation, we'd use the productService
        const productCount = 50; // Simulate fetching 50 products

        // Update progress total
        stats.entityCount += productCount;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // Simulate processing each product
        for (let i = 0; i < productCount; i++) {
          if (options.dryRun) {
            stats.skipped++;
          } else {
            try {
              // In a real implementation, sync product to POS
              stats.successful++;
            } catch (error) {
              stats.failed++;
              stats.errors.push({
                entityId: `product-${i}`,
                message: `Failed to sync product to POS: ${error.message || 'Unknown error'}`,
                details: error,
              });
            }
          }

          // Update progress
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);

          // Simulate some processing delay
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      stats.warnings.push(`Error in WooCommerce product sync: ${error.message}`);
    }
  }

  /**
   * Sync inventory between POS and WooCommerce
   */
  private async syncInventory(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const inventoryService = InventoryServiceFactory.getInstance().getService(ECommercePlatform.WOOCOMMERCE);

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
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      } else {
        // Simulate fetching inventory from WooCommerce
        const inventoryCount = 40;
        stats.entityCount += inventoryCount;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // Simulate processing
        for (let i = 0; i < inventoryCount; i++) {
          stats.successful++;
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);

          // Simulate some processing delay
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }
    } catch (error) {
      stats.warnings.push(`Error in WooCommerce inventory sync: ${error.message}`);
    }
  }

  /**
   * Sync categories between POS and WooCommerce
   */
  private async syncCategories(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const categoryService = CategoryServiceFactory.getInstance().getService(ECommercePlatform.WOOCOMMERCE);

    try {
      if (options.direction === SyncDirection.ECOMMERCE_TO_POS) {
        // Simulate fetching categories from WooCommerce
        const categoryCount = 15;
        stats.entityCount += categoryCount;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // Simulate processing
        for (let i = 0; i < categoryCount; i++) {
          stats.successful++;
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);

          // Simulate some processing delay
          await new Promise(resolve => setTimeout(resolve, 40));
        }
      } else {
        // Implement POS to WooCommerce sync
        if (!options.entityIds || options.entityIds.length === 0) {
          stats.warnings.push('No category IDs specified for sync');
          return;
        }

        // Update progress total
        stats.entityCount += options.entityIds.length;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // Process each category
        for (let i = 0; i < options.entityIds.length; i++) {
          if (options.dryRun) {
            stats.skipped++;
          } else {
            try {
              // In a real implementation, sync each category to WooCommerce
              stats.successful++;
            } catch (error) {
              stats.failed++;
              stats.errors.push({
                entityId: options.entityIds[i],
                message: `Failed to sync category: ${error.message || 'Unknown error'}`,
                details: error,
              });
            }
          }

          // Update progress
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);
          await new Promise(resolve => setTimeout(resolve, 40));
        }
      }
    } catch (error) {
      stats.warnings.push(`Error in WooCommerce category sync: ${error.message}`);
    }
  }

  /**
   * Sync orders between POS and WooCommerce
   */
  private async syncOrders(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const orderService = OrderServiceFactory.getInstance().getService(ECommercePlatform.WOOCOMMERCE);

    try {
      if (options.direction === SyncDirection.ECOMMERCE_TO_POS) {
        // Simulate fetching orders from WooCommerce
        const orderCount = 25;
        stats.entityCount += orderCount;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        for (let i = 0; i < orderCount; i++) {
          // Simulate sync operations
          if (Math.random() > 0.1) {
            // 90% success rate
            stats.successful++;
          } else {
            stats.failed++;
            stats.errors.push({
              entityId: `order-${i}`,
              message: `Failed to sync order: Simulated random failure`,
            });
          }
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);

          // Simulate some processing delay
          await new Promise(resolve => setTimeout(resolve, 60));
        }
      } else {
        // Implement POS to WooCommerce sync
        stats.warnings.push('Order sync from POS to WooCommerce not yet implemented');
      }
    } catch (error) {
      stats.warnings.push(`Error in WooCommerce order sync: ${error.message}`);
    }
  }
}
