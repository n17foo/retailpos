import { InventoryResult, InventoryUpdate, InventoryUpdateResult } from './InventoryServiceInterface';
import { PendingInventoryStore, PendingInventoryUpdate, pendingInventoryStore } from './PendingInventoryStore';
import {
  PlatformConfigRequirements,
  PlatformInventoryConfig,
  PlatformInventoryServiceInterface,
} from './platforms/PlatformInventoryServiceInterface';
import { LoggerFactory } from '../logger/LoggerFactory';
import { LoggerInterface } from '../logger/LoggerInterface';

/**
 * Decorator that persists failed platform inventory writes and retries them
 * on subsequent successful calls — closes the divergence gap where a partial
 * or failed updateInventory left platform stock out of sync with no replay.
 *
 * Retry semantics: at-least-once. Absolute writes are idempotent and coalesce;
 * deltas may double-apply if a platform applied the write but the response was
 * lost — same caveat as the generic API queue.
 */
export class RetryingInventoryService implements PlatformInventoryServiceInterface {
  private readonly logger: LoggerInterface = LoggerFactory.getInstance().createLogger('RetryingInventoryService');
  private draining = false;

  constructor(
    private readonly inner: PlatformInventoryServiceInterface,
    private readonly platform: string,
    private readonly store: PendingInventoryStore = pendingInventoryStore
  ) {}

  // PlatformInventoryServiceInterface delegation
  getConfigRequirements(): PlatformConfigRequirements {
    return this.inner.getConfigRequirements();
  }

  initialize(config: PlatformInventoryConfig): Promise<boolean> {
    return this.inner.initialize(config);
  }

  isInitialized(): boolean {
    return this.inner.isInitialized();
  }

  async getInventory(productIds: string[]): Promise<InventoryResult> {
    const result = await this.inner.getInventory(productIds);
    // A successful read proves connectivity — drain queued writes opportunistically
    this.drain().catch(() => {});
    return result;
  }

  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    let result: InventoryUpdateResult;
    try {
      result = await this.inner.updateInventory(updates);
    } catch (error) {
      // Wholesale failure — queue everything for replay
      await this.queueUpdates(updates);
      this.logger.warn({ message: `Inventory update failed; ${updates.length} update(s) queued for retry` });
      throw error;
    }

    if (result.failed > 0) {
      await this.queueUpdates(this.extractFailedUpdates(updates, result));
    }

    return result;
  }

  /**
   * Replays queued updates oldest-first. Entries that fail again stay queued.
   */
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const pending = await this.store.list(this.platform);
      if (pending.length === 0) return;

      const succeeded: PendingInventoryUpdate[] = [];
      for (const entry of pending) {
        try {
          const res = await this.inner.updateInventory([entry.update]);
          if (res.failed === 0) {
            succeeded.push(entry);
          }
        } catch {
          break; // still offline/unreachable — stop draining
        }
      }

      if (succeeded.length > 0) {
        await this.store.remove(this.platform, succeeded);
        this.logger.info({ message: `Replayed ${succeeded.length} queued inventory update(s) for ${this.platform}` });
      }
    } finally {
      this.draining = false;
    }
  }

  private async queueUpdates(updates: InventoryUpdate[]): Promise<void> {
    try {
      await this.store.add(this.platform, updates);
    } catch (error) {
      this.logger.error(
        { message: 'Failed to persist pending inventory update' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private extractFailedUpdates(updates: InventoryUpdate[], result: InventoryUpdateResult): InventoryUpdate[] {
    const failedKeys = new Set(result.errors.filter(e => e.productId !== 'general').map(e => `${e.productId}::${e.variantId ?? ''}`));

    if (failedKeys.size === 0) {
      // Errors weren't item-addressable — safest is to replay the batch
      return updates;
    }
    return updates.filter(u => failedKeys.has(`${u.productId}::${u.variantId ?? ''}`));
  }
}
