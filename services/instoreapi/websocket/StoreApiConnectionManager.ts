/**
 * StoreApiConnectionManager
 *
 * Manages the lifecycle of the WebSocket connection to the store-api.
 * Coordinates between the WebSocket, snapshot service, and sync poller.
 *
 * Responsibilities:
 *   - Starts/stops the WebSocket based on register mode (client/server)
 *   - Handles snapshot_needed by fetching and applying snapshots
 *   - Persists last_acked_server_seq and snapshot_version to KV store
 *   - Falls back to SyncPoller when WebSocket is unavailable
 *   - Provides connection state to the UI
 */

import { instoreApiConfig } from '../InstoreApiConfig';
import { storeApiWebSocket, ConnectionState, StoreApiWSEvent } from './StoreApiWebSocket';
import { snapshotService } from './SnapshotService';
import { syncPoller } from '../sync/SyncPoller';
import { keyValueRepository } from '../../../repositories/KeyValueRepository';
import { LoggerFactory } from '../../logger/LoggerFactory';

const KV_LAST_SEQ = 'instoreapi.ws.last_acked_seq';
const KV_SNAPSHOT_VER = 'instoreapi.ws.snapshot_version';

type ConnectionStateListener = (state: ConnectionState) => void;

export class StoreApiConnectionManager {
  private static instance: StoreApiConnectionManager;
  private logger = LoggerFactory.getInstance().createLogger('StoreApiConnectionManager');
  private listeners = new Set<ConnectionStateListener>();
  private started = false;
  private usingFallback = false;

  private constructor() {}

  static getInstance(): StoreApiConnectionManager {
    if (!StoreApiConnectionManager.instance) {
      StoreApiConnectionManager.instance = new StoreApiConnectionManager();
    }
    return StoreApiConnectionManager.instance;
  }

  get isStarted(): boolean {
    return this.started;
  }

  get connectionState(): ConnectionState {
    return storeApiWebSocket.state;
  }

  /**
   * Start the real-time connection layer.
   * - In client mode: connects WebSocket to the server register
   * - In server mode: connects WebSocket to itself (for payment events)
   * - In standalone mode: no-op
   */
  async start(): Promise<void> {
    if (this.started) return;
    if (instoreApiConfig.isStandalone) {
      this.logger.info('Standalone mode — WebSocket not needed');
      return;
    }

    this.started = true;

    // Restore persisted state
    const lastSeq = await this.loadNumber(KV_LAST_SEQ);
    const snapshotVer = await this.loadNumber(KV_SNAPSHOT_VER);
    storeApiWebSocket.restoreState(lastSeq, snapshotVer);

    // Wire up event handlers
    storeApiWebSocket.on('snapshot_needed', this.handleSnapshotNeeded);
    storeApiWebSocket.on('connection_state', this.handleConnectionStateChange);
    storeApiWebSocket.on('connected', this.handleConnected);
    storeApiWebSocket.on('disconnected', this.handleDisconnected);

    // Attempt WebSocket connection
    storeApiWebSocket.connect();
  }

  /**
   * Stop the real-time connection layer.
   */
  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;

    storeApiWebSocket.off('snapshot_needed', this.handleSnapshotNeeded);
    storeApiWebSocket.off('connection_state', this.handleConnectionStateChange);
    storeApiWebSocket.off('connected', this.handleConnected);
    storeApiWebSocket.off('disconnected', this.handleDisconnected);

    storeApiWebSocket.disconnect();
    syncPoller.stop();

    // Persist state
    await this.persistState();
  }

  /**
   * Subscribe to connection state changes.
   */
  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  private handleSnapshotNeeded = async (event: StoreApiWSEvent): Promise<void> => {
    if (event.type !== 'snapshot_needed') return;

    this.logger.info('Server requested snapshot — fetching full state');
    const version = await snapshotService.fetchAndApply();
    if (version > 0) {
      storeApiWebSocket.restoreState(storeApiWebSocket.lastAckedSeq, version);
      await keyValueRepository.setItem(KV_SNAPSHOT_VER, String(version));
    }
  };

  private handleConnectionStateChange = (event: StoreApiWSEvent): void => {
    if (event.type !== 'connection_state') return;
    const state = (event as { type: 'connection_state'; state: ConnectionState }).state;

    // Notify listeners
    this.listeners.forEach(fn => fn(state));

    // If WebSocket is reconnecting for too long, fall back to polling
    if (state === 'reconnecting' && !this.usingFallback) {
      this.logger.info('WebSocket reconnecting — starting SyncPoller as fallback');
      this.usingFallback = true;
      syncPoller.start();
    }
  };

  private handleConnected = (): void => {
    // WebSocket is live — stop the fallback poller
    if (this.usingFallback) {
      this.logger.info('WebSocket restored — stopping SyncPoller fallback');
      this.usingFallback = false;
      syncPoller.stop();
    }
  };

  private handleDisconnected = (): void => {
    // Persist current seq on disconnect so we can resume correctly
    this.persistState().catch(() => {
      // Best effort — swallow errors
    });
  };

  // ── Persistence ─────────────────────────────────────────────────────────────

  private async persistState(): Promise<void> {
    try {
      await keyValueRepository.setItem(KV_LAST_SEQ, String(storeApiWebSocket.lastAckedSeq));
    } catch {
      // Non-critical — will be slightly behind on next connect
    }
  }

  private async loadNumber(key: string): Promise<number> {
    try {
      const raw = await keyValueRepository.getItem(key);
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }
}

export const storeApiConnectionManager = StoreApiConnectionManager.getInstance();
