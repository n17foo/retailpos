/**
 * SnapshotService
 *
 * Fetches and applies a full state snapshot from the store-api when the
 * WebSocket handshake determines the device is too far behind for replay.
 *
 * Called when the server sends `{ type: "snapshot_needed", payload: { url: "/api/snapshot" } }`.
 */

import { instoreApiClient } from '../../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { syncEventBus } from '../sync/SyncEventBus';

export interface SnapshotPayload {
  snapshot_version: number;
  orders: unknown[];
  products: unknown[];
  categories: unknown[];
  tax_profiles: unknown[];
}

export class SnapshotService {
  private static instance: SnapshotService;
  private logger = LoggerFactory.getInstance().createLogger('SnapshotService');
  private applying = false;

  private constructor() {}

  static getInstance(): SnapshotService {
    if (!SnapshotService.instance) {
      SnapshotService.instance = new SnapshotService();
    }
    return SnapshotService.instance;
  }

  get isApplying(): boolean {
    return this.applying;
  }

  /**
   * Fetch a full snapshot from the store-api and emit sync events so the
   * existing service layer can process the data.
   *
   * @returns The snapshot_version for persistence (used in next HELLO).
   */
  async fetchAndApply(): Promise<number> {
    if (this.applying) {
      this.logger.warn('Snapshot already in progress — skipping');
      return 0;
    }

    this.applying = true;
    try {
      this.logger.info('Fetching snapshot from store-api');
      const snapshot = await instoreApiClient.getSnapshot();

      this.logger.info(
        `Snapshot received: ${snapshot.orders?.length ?? 0} orders, ` +
          `${snapshot.products?.length ?? 0} products, ` +
          `${snapshot.categories?.length ?? 0} categories`
      );

      // The catalogue and order stores are server-authoritative in client
      // mode — "applying" a snapshot means telling every consumer its view is
      // stale so it refetches. Emit on the event types the existing hooks and
      // services already subscribe to, then a summary marker for anything else.
      syncEventBus.emit('order:updated', { snapshotApplied: true, count: snapshot.orders?.length ?? 0 });
      syncEventBus.emit('product:updated', { snapshotApplied: true, count: snapshot.products?.length ?? 0 });
      syncEventBus.emit('inventory:updated', { snapshotApplied: true });
      syncEventBus.emit('config:updated', {
        entity: 'snapshot',
        action: 'applied',
        snapshotVersion: snapshot.snapshot_version,
        data: {
          orders: snapshot.orders,
          products: snapshot.products,
          categories: snapshot.categories,
          taxProfiles: snapshot.tax_profiles,
        },
      });

      return snapshot.snapshot_version ?? Date.now();
    } catch (error) {
      this.logger.error({ message: 'Failed to fetch snapshot' }, error instanceof Error ? error : new Error(String(error)));
      return 0;
    } finally {
      this.applying = false;
    }
  }
}

export const snapshotService = SnapshotService.getInstance();
