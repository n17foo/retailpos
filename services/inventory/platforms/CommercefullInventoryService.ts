/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import {
  PlatformInventoryServiceInterface,
  PlatformInventoryConfig,
  PlatformConfigRequirements,
} from './PlatformInventoryServiceInterface';
import { CommercefullApiClient, CommercefullConfig } from '../../clients/commercefull/CommercefullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * Commercefull platform implementation of the inventory service.
 *
 * Endpoint mapping:
 *   GET  /business/inventory/items?productId=…        → getInventory (per-product stock)
 *   GET  /business/inventory/items/lookup?productId=… → resolve item for adjustments
 *   POST /business/inventory/locations/:id/adjust     → updateInventory
 *        body: { quantityChange: signed int, reason, transactionTypeCode? }
 *
 * Note: /business/inventory (without /items) lists inventory *locations*
 * (warehouses), not product stock. Stock lives on inventory items keyed by
 * inventoryItemId, which is what the adjust endpoint expects.
 */
export class CommercefullInventoryService implements PlatformInventoryServiceInterface {
  private initialized = false;
  private config: PlatformInventoryConfig = {};
  private apiClient: CommercefullApiClient;
  private logger = LoggerFactory.getInstance().createLogger('CommercefullInventoryService');

  constructor(config: PlatformInventoryConfig = {}) {
    this.config = config;
    this.apiClient = CommercefullApiClient.getInstance();
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

      const clientConfig: CommercefullConfig = {
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
        { message: 'Failed to initialize Commercefull inventory service' },
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
      throw new Error('Commercefull inventory service not initialized');
    }

    if (productIds.length === 0) {
      return { items: [] };
    }

    try {
      // The items endpoint filters by a single productId; query per product
      // and aggregate stock across inventory locations.
      const aggregated = new Map<string, { productId: string; variantId?: string; quantity: number; sku?: string; updatedAt?: Date }>();

      for (const productId of productIds) {
        const data = await this.apiClient.get<any>('/business/inventory/items', {
          productId: String(productId),
          limit: '100',
        });
        const payload = data?.data || {};
        const items = Array.isArray(payload) ? payload : payload.items || [];

        for (const item of items) {
          const variantId = item.variantId ? String(item.variantId) : undefined;
          const key = `${productId}:${variantId || ''}`;
          const existing = aggregated.get(key);
          const available = item.availableQuantity ?? item.quantity ?? 0;
          if (existing) {
            existing.quantity += available;
          } else {
            aggregated.set(key, {
              productId: String(item.productId || productId),
              variantId,
              quantity: available,
              sku: item.sku || '',
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
            });
          }
        }
      }

      return { items: Array.from(aggregated.values()) };
    } catch (error) {
      this.logger.error(
        { message: 'Error fetching inventory from Commercefull' },
        error instanceof Error ? error : new Error(String(error))
      );
      return { items: [] };
    }
  }

  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull inventory service not initialized');
    }

    const result: InventoryUpdateResult = { successful: 0, failed: 0, errors: [] };

    // Commercefull adjusts inventory one location item at a time with a
    // signed quantityChange.
    for (const update of updates) {
      try {
        const item = await this.lookupInventoryItem(update);
        if (!item) {
          throw new Error(
            `No inventory item found for product ${update.productId}${update.variantId ? ` variant ${update.variantId}` : ''}`
          );
        }

        const inventoryLocationId = String(item.inventoryItemId || item.inventoryId || item.id || '');
        if (!inventoryLocationId) {
          throw new Error(`Inventory item for product ${update.productId} has no location id`);
        }

        // adjustment=true → quantity is a delta; otherwise it's an absolute
        // target, so compute the delta from current stock.
        const quantityChange =
          (update.adjustment ?? true) ? update.quantity : update.quantity - (item.availableQuantity ?? item.quantity ?? 0);

        await this.apiClient.post(`/business/inventory/locations/${inventoryLocationId}/adjust`, {
          quantityChange,
          reason: 'POS inventory update',
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

  /** Resolve the inventory item (stock record) for a product/variant. */
  private async lookupInventoryItem(update: InventoryUpdate): Promise<any | null> {
    const params: Record<string, string> = { productId: String(update.productId) };
    if (update.variantId) params.variantId = String(update.variantId);

    const data = await this.apiClient.get<any>('/business/inventory/items/lookup', params);
    const item = data?.data || data?.item || data;
    return item && (item.inventoryItemId || item.inventoryId || item.id || item.productId) ? item : null;
  }
}
