/**
 * InventoryCountService
 *
 * Manages stock-take sessions: start, count items, finalise, discard.
 * On finalise, pushes absolute quantity corrections to the platform.
 *
 * See: docs/specs/inventory/inventory.md §7.4
 */

import { procurementRepository, InventoryCountRow, InventoryCountItemRow } from '../../repositories/ProcurementRepository';
import { InventoryServiceFactory } from '../inventory/InventoryServiceFactory';
import { auditLogService } from '../audit/AuditLogService';
import { LoggerFactory } from '../logger/LoggerFactory';
import { ECommercePlatform } from '../../utils/platforms';
import { getPlatformCapabilities } from '../../utils/platformCapabilities';

export interface CountItemInput {
  productId: string;
  variantId?: string | null;
  productName: string;
  sku?: string | null;
  expectedQty: number;
}

export interface FinaliseResult {
  success: boolean;
  adjustedLines: number;
  totalVariance: number;
  error?: string;
}

export class InventoryCountService {
  private static instance: InventoryCountService;
  private logger = LoggerFactory.getInstance().createLogger('InventoryCountService');

  private constructor() {}

  static getInstance(): InventoryCountService {
    if (!InventoryCountService.instance) {
      InventoryCountService.instance = new InventoryCountService();
    }
    return InventoryCountService.instance;
  }

  async startCount(items: CountItemInput[], startedBy?: string, notes?: string): Promise<string> {
    const countId = await procurementRepository.createCount(startedBy ?? null, notes ?? null);

    for (const item of items) {
      await procurementRepository.addCountItem(
        countId,
        item.productId,
        item.variantId ?? null,
        item.productName,
        item.sku ?? null,
        item.expectedQty
      );
    }

    this.logger.info(`Inventory count ${countId} started with ${items.length} items`);
    return countId;
  }

  async updateCountedQty(itemId: string, countedQty: number): Promise<void> {
    await procurementRepository.updateCountedQty(itemId, countedQty);
  }

  async findCountById(id: string): Promise<InventoryCountRow | null> {
    return procurementRepository.findCountById(id);
  }

  async findAllCounts(): Promise<InventoryCountRow[]> {
    return procurementRepository.findAllCounts();
  }

  async findCountItems(countId: string): Promise<InventoryCountItemRow[]> {
    return procurementRepository.findCountItems(countId);
  }

  async finaliseCount(countId: string, platform: ECommercePlatform, finalisedBy?: string): Promise<FinaliseResult> {
    try {
      const items = await procurementRepository.findCountItems(countId);
      const variantLines = items.filter(i => i.counted_qty !== null);

      let totalVariance = 0;
      const adjustments = variantLines
        .map(item => {
          const variance = (item.counted_qty ?? 0) - item.expected_qty;
          totalVariance += variance;
          return variance !== 0
            ? { productId: item.product_id, variantId: item.variant_id ?? undefined, quantity: item.counted_qty!, adjustment: false }
            : null;
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      // Push corrections to platform
      const capabilities = getPlatformCapabilities(platform);
      if (adjustments.length > 0 && capabilities.inventory !== 'not_recommended') {
        const inventoryService = InventoryServiceFactory.getInstance().getService(platform);
        await inventoryService.updateInventory(adjustments).catch(err => {
          this.logger.warn({
            message: `Inventory correction push failed for count ${countId}: ${err instanceof Error ? err.message : String(err)}`,
          });
        });
      }

      const now = Date.now();
      await procurementRepository.updateCountStatus(countId, 'completed', now);

      await auditLogService.log('inventory_count:completed', {
        userId: finalisedBy,
        details: `Inventory count ${countId} completed — ${adjustments.length} adjustment(s), total variance ${totalVariance}`,
        metadata: { countId, adjustedLines: adjustments.length, totalVariance },
      });

      return { success: true, adjustedLines: adjustments.length, totalVariance };
    } catch (err) {
      this.logger.error({ message: `Failed to finalise count ${countId}` }, err instanceof Error ? err : new Error(String(err)));
      return { success: false, adjustedLines: 0, totalVariance: 0, error: err instanceof Error ? err.message : 'Finalise failed' };
    }
  }

  async discardCount(countId: string): Promise<void> {
    await procurementRepository.updateCountStatus(countId, 'discarded');
    this.logger.info(`Inventory count ${countId} discarded`);
  }
}

export const inventoryCountService = InventoryCountService.getInstance();
