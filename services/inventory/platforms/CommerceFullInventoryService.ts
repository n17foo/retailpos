/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import {
  PlatformInventoryServiceInterface,
  PlatformInventoryConfig,
  PlatformConfigRequirements,
} from './PlatformInventoryServiceInterface';
import { CommerceFullApiClient, CommerceFullConfig } from '../../clients/commercefull/CommerceFullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * CommerceFull platform implementation of the inventory service.
 *
 * Endpoint mapping:
 *   GET  /business/inventory                         → getInventory (list all, filter client-side)
 *   POST /business/inventory/:id/adjust              → updateInventory (one at a time)
 *   GET  /business/inventory/availability/:sku        → availability check (customer-facing)
 */
export class CommerceFullInventoryService implements PlatformInventoryServiceInterface {
  private initialized = false;
  private config: PlatformInventoryConfig = {};
  private apiClient: CommerceFullApiClient;
  private logger = LoggerFactory.getInstance().createLogger('CommerceFullInventoryService');

  constructor(config: PlatformInventoryConfig = {}) {
    this.config = config;
    this.apiClient = CommerceFullApiClient.getInstance();
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey', 'apiSecret'],
      optional: ['apiVersion'],
    };
  }

  async initialize(config?: PlatformInventoryConfig): Promise<boolean> {
    try {
      if (config) this.config = config;

      const clientConfig: CommerceFullConfig = {
        storeUrl: this.config.storeUrl,
        apiKey: this.config.apiKey,
        apiSecret: this.config.apiSecret,
        apiVersion: this.config.apiVersion,
      };

      this.apiClient.configure(clientConfig);
      const ok = await this.apiClient.initialize();
      if (ok) this.initialized = true;
      return ok;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize CommerceFull inventory service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getInventory(productIds: string[]): Promise<InventoryResult> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull inventory service not initialized');
    }

    try {
      // Fetch full inventory list and filter by productIds
      const data = await this.apiClient.get<any>('/business/inventory');
      const allItems = data.data || data.items || data || [];

      const productIdSet = new Set(productIds.map(String));
      const filtered = allItems.filter((item: any) => productIdSet.has(String(item.productId || item.id)));

      return {
        items: filtered.map((item: any) => ({
          productId: String(item.productId || item.id || ''),
          variantId: item.variantId ? String(item.variantId) : undefined,
          quantity: item.quantity ?? item.stockQuantity ?? item.available ?? 0,
          sku: item.sku || '',
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
        })),
      };
    } catch (error) {
      this.logger.error(
        { message: 'Error fetching inventory from CommerceFull' },
        error instanceof Error ? error : new Error(String(error))
      );
      return { items: [] };
    }
  }

  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull inventory service not initialized');
    }

    const result: InventoryUpdateResult = { successful: 0, failed: 0, errors: [] };

    // CommerceFull adjusts inventory one item at a time
    for (const update of updates) {
      try {
        const inventoryId = update.variantId || update.productId;
        await this.apiClient.post(`/business/inventory/${inventoryId}/adjust`, {
          quantity: update.quantity,
          adjustment: update.adjustment ?? true,
        });
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          productId: update.productId,
          variantId: update.variantId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }
}
