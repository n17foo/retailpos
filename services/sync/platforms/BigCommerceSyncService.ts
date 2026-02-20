import { SyncDirection, SyncEntityType, SyncError, SyncOperationResult, SyncOptions } from '../SyncServiceInterface';
import { BasePlatformSyncService } from './BasePlatformSyncService';
import { PlatformSyncConfig, PlatformSyncConfigRequirements } from './PlatformSyncServiceInterface';
import { ProductServiceFactory } from '../../product/ProductServiceFactory';
import { InventoryServiceFactory } from '../../inventory/InventoryServiceFactory';
import { CategoryServiceFactory } from '../../category/CategoryServiceFactory';
import { OrderServiceFactory } from '../../order/OrderServiceFactory';
import { ECommercePlatform } from '../../../utils/platforms';

/**
 * BigCommerce-specific sync service implementation
 */
export class BigCommerceSyncService extends BasePlatformSyncService {
  private webhookIds: string[] = [];

  /**
   * Get configuration requirements for BigCommerce
   */
  getConfigRequirements(): PlatformSyncConfigRequirements {
    return {
      required: ['storeHash', 'accessToken', 'clientId'],
      optional: ['webhookUrl', 'batchSize'],
    };
  }

  /**
   * Initialize the BigCommerce sync service
   */
  async initialize(config: PlatformSyncConfig): Promise<boolean> {
    // Call base class initialization
    const baseInitialized = await super.initialize(config);
    if (!baseInitialized) {
      return false;
    }

    // Additional BigCommerce-specific initialization could go here
    return true;
  }

  /**
   * Test connection to BigCommerce API
   */
  async testConnection(): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      // Test connection by making a simple API call
      const url = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/catalog/summary`;

      const response = await fetch(url, {
        headers: {
          'X-Auth-Token': this.config.accessToken,
          'X-Auth-Client': this.config.clientId,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.error('BigCommerce connection test failed:', response.statusText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error testing BigCommerce connection:', error);
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
      // Define webhook scopes for BigCommerce
      const webhookScopes = [
        {
          scope: 'store/product/*',
          name: 'Product Events',
        },
        {
          scope: 'store/category/*',
          name: 'Category Events',
        },
        {
          scope: 'store/order/*',
          name: 'Order Events',
        },
        {
          scope: 'store/inventory/*',
          name: 'Inventory Events',
        },
      ];

      // Register each webhook
      const results = await Promise.all(
        webhookScopes.map(async ({ scope, name }) => {
          try {
            const url = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/hooks`;

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'X-Auth-Token': this.config.accessToken,
                'X-Auth-Client': this.config.clientId,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                name,
                scope,
                destination: webhookUrl,
                is_active: true,
                headers: {
                  'X-Webhook-Source': 'RetailPOS-BigCommerce',
                },
              }),
            });

            if (!response.ok) {
              console.error(`Failed to register BigCommerce webhook for ${scope}:`, response.statusText);
              return null;
            }

            const data = await response.json();
            return data.data?.id;
          } catch (error) {
            console.error(`Error registering BigCommerce webhook for ${scope}:`, error);
            return null;
          }
        })
      );

      // Store successful webhook IDs
      this.webhookIds = results.filter(Boolean) as string[];

      return this.webhookIds.length > 0;
    } catch (error) {
      console.error('Error registering BigCommerce webhooks:', error);
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
            const url = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/hooks/${webhookId}`;

            const response = await fetch(url, {
              method: 'DELETE',
              headers: {
                'X-Auth-Token': this.config.accessToken,
                'X-Auth-Client': this.config.clientId,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
            });

            return response.ok;
          } catch (error) {
            console.error(`Error unregistering BigCommerce webhook ${webhookId}:`, error);
            return false;
          }
        })
      );

      // Clear webhook IDs
      this.webhookIds = [];

      // Return true if all webhooks were successfully deleted
      return results.every(Boolean);
    } catch (error) {
      console.error('Error unregistering BigCommerce webhooks:', error);
      return false;
    }
  }

  /**
   * Execute a sync operation against BigCommerce
   */
  protected async executeSyncOperation(syncId: string, options: SyncOptions): Promise<void> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce sync service not initialized');
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
          warnings.push(`Entity type ${options.entityType} not supported for BigCommerce sync`);
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
      console.error(`Error in BigCommerce sync operation ${syncId}:`, error);
      throw error;
    }
  }

  /**
   * Sync products between POS and BigCommerce
   */
  private async syncProducts(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const productService = ProductServiceFactory.getInstance().getService(ECommercePlatform.BIGCOMMERCE);

    try {
      if (options.direction === SyncDirection.POS_TO_ECOMMERCE) {
        // Handle POS to BigCommerce sync
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
              // In a real implementation, sync each product to BigCommerce
              stats.successful++;

              // Simulate occasional failures
              if (Math.random() > 0.9) {
                // 10% failure rate
                throw new Error('Simulated API error');
              }
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

          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, 45));
        }
      } else if (options.direction === SyncDirection.ECOMMERCE_TO_POS) {
        // Simulate fetching products from BigCommerce
        const productCount = 35;
        stats.entityCount += productCount;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

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
                entityId: `bc-product-${i}`,
                message: `Failed to sync product to POS: ${error.message || 'Unknown error'}`,
                details: error,
              });
            }
          }

          // Update progress
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);
          await new Promise(resolve => setTimeout(resolve, 55));
        }
      }
    } catch (error) {
      stats.warnings.push(`Error in BigCommerce product sync: ${error.message}`);
    }
  }

  /**
   * Sync inventory between POS and BigCommerce
   */
  private async syncInventory(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const inventoryService = InventoryServiceFactory.getInstance().getService(ECommercePlatform.BIGCOMMERCE);

    try {
      // BigCommerce handles inventory as part of products, so this sync is simpler
      if (options.direction === SyncDirection.POS_TO_ECOMMERCE) {
        if (!options.entityIds || options.entityIds.length === 0) {
          stats.warnings.push('No inventory IDs specified for sync');
          return;
        }

        // Update progress total
        stats.entityCount += options.entityIds.length;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // Process inventory updates
        for (let i = 0; i < options.entityIds.length; i++) {
          if (options.dryRun) {
            stats.skipped++;
          } else {
            // Simulate inventory sync
            stats.successful++;
          }

          // Update progress
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);
          await new Promise(resolve => setTimeout(resolve, 35));
        }
      } else {
        stats.warnings.push('BigCommerce inventory sync from platform to POS is handled as part of product sync');
      }
    } catch (error) {
      stats.warnings.push(`Error in BigCommerce inventory sync: ${error.message}`);
    }
  }

  /**
   * Sync categories between POS and BigCommerce
   */
  private async syncCategories(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const categoryService = CategoryServiceFactory.getInstance().getService(ECommercePlatform.BIGCOMMERCE);

    try {
      if (options.direction === SyncDirection.ECOMMERCE_TO_POS) {
        // Get categories from BigCommerce
        // In a real implementation, we'd use the categoryService.getCategories()
        // For now, just simulate the process
        const categoryCount = 20;
        stats.entityCount += categoryCount;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // Process each category
        for (let i = 0; i < categoryCount; i++) {
          if (options.dryRun) {
            stats.skipped++;
          } else {
            try {
              // Simulate syncing a category to POS
              stats.successful++;
            } catch (error) {
              stats.failed++;
              stats.errors.push({
                entityId: `bc-category-${i}`,
                message: `Failed to sync category: ${error.message || 'Unknown error'}`,
                details: error,
              });
            }
          }

          // Update progress
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);
          await new Promise(resolve => setTimeout(resolve, 40));
        }
      } else {
        // Handle POS to BigCommerce sync
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
              // In a real implementation, sync each category to BigCommerce
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
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      stats.warnings.push(`Error in BigCommerce category sync: ${error.message}`);
    }
  }

  /**
   * Sync orders between POS and BigCommerce
   */
  private async syncOrders(
    syncId: string,
    options: SyncOptions,
    stats: { successful: number; failed: number; skipped: number; errors: SyncError[]; warnings: string[]; entityCount: number }
  ): Promise<void> {
    const orderService = OrderServiceFactory.getInstance().getService(ECommercePlatform.BIGCOMMERCE);

    try {
      if (options.direction === SyncDirection.ECOMMERCE_TO_POS) {
        // Simulate fetching orders from BigCommerce
        const orderCount = 15;
        stats.entityCount += orderCount;
        this.updateSyncProgress(syncId, 0, stats.entityCount);

        // Process each order
        for (let i = 0; i < orderCount; i++) {
          if (options.dryRun) {
            stats.skipped++;
          } else {
            try {
              // Simulate syncing an order to POS
              stats.successful++;
            } catch (error) {
              stats.failed++;
              stats.errors.push({
                entityId: `bc-order-${i}`,
                message: `Failed to sync order: ${error.message || 'Unknown error'}`,
                details: error,
              });
            }
          }

          // Update progress
          this.updateSyncProgress(syncId, stats.successful + stats.failed + stats.skipped, stats.entityCount);
          await new Promise(resolve => setTimeout(resolve, 70));
        }
      } else {
        // BigCommerce typically doesn't support creating orders from external sources
        stats.warnings.push('Order sync from POS to BigCommerce is not supported');

        // Still mark as "skipped" for any entities that were requested
        if (options.entityIds && options.entityIds.length > 0) {
          stats.skipped += options.entityIds.length;
          stats.entityCount += options.entityIds.length;
          this.updateSyncProgress(syncId, stats.skipped, stats.entityCount);
        }
      }
    } catch (error) {
      stats.warnings.push(`Error in BigCommerce order sync: ${error.message}`);
    }
  }
}
