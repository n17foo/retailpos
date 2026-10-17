import { KeyValueRepository } from '../../repositories/KeyValueRepository';
import { InventoryUpdate } from './InventoryServiceInterface';

const STORAGE_KEY = 'inventory:pendingUpdates';

export interface PendingInventoryUpdate {
  platform: string;
  update: InventoryUpdate;
  queuedAt: number;
}

/**
 * KV-backed store for inventory updates that failed to reach the platform.
 * Drained by RetryingInventoryService on subsequent successful reads/writes.
 */
export class PendingInventoryStore {
  private kv = new KeyValueRepository();

  private async readAll(): Promise<PendingInventoryUpdate[]> {
    const raw = await this.kv.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as PendingInventoryUpdate[];
    } catch {
      return [];
    }
  }

  private async writeAll(entries: PendingInventoryUpdate[]): Promise<void> {
    await this.kv.setItem(STORAGE_KEY, entries);
  }

  private updateKey(u: InventoryUpdate): string {
    return `${u.productId}::${u.variantId ?? ''}`;
  }

  /**
   * Queue failed updates. Absolute (`adjustment:false`) writes coalesce per
   * item — the latest target quantity wins. Deltas append (each represents a
   * distinct intended change).
   */
  async add(platform: string, updates: InventoryUpdate[]): Promise<void> {
    if (updates.length === 0) return;
    const all = await this.readAll();
    for (const update of updates) {
      if (update.adjustment === false) {
        // Latest absolute value wins for the same item
        const key = this.updateKey(update);
        for (let i = all.length - 1; i >= 0; i--) {
          if (all[i].platform === platform && all[i].update.adjustment === false && this.updateKey(all[i].update) === key) {
            all.splice(i, 1);
          }
        }
      }
      all.push({ platform, update, queuedAt: Date.now() });
    }
    await this.writeAll(all);
  }

  async list(platform: string): Promise<PendingInventoryUpdate[]> {
    return (await this.readAll()).filter(e => e.platform === platform);
  }

  async remove(platform: string, entries: PendingInventoryUpdate[]): Promise<void> {
    const drop = new Set(entries.map(e => `${e.platform}::${e.queuedAt}::${this.updateKey(e.update)}::${e.update.quantity}`));
    const remaining = (await this.readAll()).filter(
      e => !drop.has(`${e.platform}::${e.queuedAt}::${this.updateKey(e.update)}::${e.update.quantity}`)
    );
    await this.writeAll(remaining);
  }

  async count(platform: string): Promise<number> {
    return (await this.list(platform)).length;
  }
}

export const pendingInventoryStore = new PendingInventoryStore();
