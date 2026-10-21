import { instoreApiClient } from '../../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { InventoryServiceInterface, InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';

/**
 * Store API-backed inventory for multi-register deployments.
 * Stock lives in the server products table so all registers see the same
 * quantities. Adjustments are read-modify-write — concurrent +N updates from
 * two registers can race; acceptable at current scale, tighten server-side if
 * it ever bites.
 */
export class InstoreApiInventoryService implements InventoryServiceInterface {
  private logger = LoggerFactory.getInstance().createLogger('InstoreApiInventoryService');

  async initialize(): Promise<boolean> {
    return true;
  }

  isInitialized(): boolean {
    return true;
  }

  async getInventory(productIds: string[]): Promise<InventoryResult> {
    const items = [];
    for (const productId of productIds) {
      const row = await instoreApiClient.getProduct(productId);
      if (row) {
        items.push({
          productId: row.id,
          quantity: row.stock,
          sku: row.sku ?? undefined,
          updatedAt: new Date(row.updated_at),
        });
      }
    }
    return { items };
  }

  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    const errors: Array<{ productId: string; variantId?: string; error: string }> = [];
    let successful = 0;
    for (const update of updates) {
      try {
        const row = await instoreApiClient.getProduct(update.productId);
        if (!row) {
          errors.push({ productId: update.productId, variantId: update.variantId, error: 'Product not found' });
          continue;
        }
        const newStock = update.adjustment ? row.stock + update.quantity : update.quantity;
        await instoreApiClient.updateProduct(update.productId, { stock: Math.max(0, newStock) });
        successful++;
      } catch (error) {
        errors.push({
          productId: update.productId,
          variantId: update.variantId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return { successful, failed: errors.length, errors };
  }

  async getAllInventory(): Promise<InventoryResult> {
    const rows = await instoreApiClient.getProducts();
    return {
      items: rows.map(row => ({
        productId: row.id,
        quantity: row.stock,
        sku: row.sku ?? undefined,
        updatedAt: new Date(row.updated_at),
      })),
    };
  }

  async getLowStockItems(threshold = 5): Promise<InventoryResult> {
    const { items } = await this.getAllInventory();
    return { items: items.filter(item => item.quantity > 0 && item.quantity <= threshold) };
  }

  async getOutOfStockItems(): Promise<InventoryResult> {
    const { items } = await this.getAllInventory();
    return { items: items.filter(item => item.quantity <= 0) };
  }
}

export const instoreApiInventoryService = new InstoreApiInventoryService();
