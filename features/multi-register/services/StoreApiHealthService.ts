import { instoreApiConfig } from './InstoreApiConfig';
import { storeApiConnectionManager } from './websocket/StoreApiConnectionManager';
import { isStoreApiUnavailable } from './offline/isStoreApiUnavailable';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';
import type { ConnectionState } from './websocket/StoreApiWebSocket';

export type LanState = 'online' | 'degraded';

const PROBE_INTERVAL_MS = 5000;
const PROBE_TIMEOUT_MS = 2500;

/**
 * Tracks whether the in-store server is reachable on the LAN.
 *
 * Signals:
 *  - WebSocket connection state (fastest signal when it transitions)
 *  - request outcomes reported by InstoreApiClient (a network failure on any
 *    request flips us to degraded immediately; any success flips us back)
 *  - while degraded, a periodic unauthenticated GET /api/health probe detects
 *    recovery even before the WebSocket reconnects
 *
 * Consumers subscribe via onStateChange / onRecovery. `isDegraded` is the
 * synchronous read used by service-level fallbacks (order queueing,
 * catalogue/user caches).
 */
export class StoreApiHealthService {
  private static instance: StoreApiHealthService;
  private logger = LoggerFactory.getInstance().createLogger('StoreApiHealthService');
  private state: LanState = 'online';
  private started = false;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private probing = false;
  private unsubscribeConnection: (() => void) | null = null;
  private stateListeners = new Set<(state: LanState) => void>();
  private recoveryListeners = new Set<() => void>();

  private constructor() {}

  static getInstance(): StoreApiHealthService {
    if (!StoreApiHealthService.instance) {
      StoreApiHealthService.instance = new StoreApiHealthService();
    }
    return StoreApiHealthService.instance;
  }

  get lanState(): LanState {
    return this.state;
  }

  get isDegraded(): boolean {
    return this.state === 'degraded';
  }

  /** Wire WS state + start probing. No-op outside client mode. */
  start(): void {
    if (this.started || !instoreApiConfig.isClient) return;
    this.started = true;
    this.unsubscribeConnection = storeApiConnectionManager.onConnectionStateChange(state => this.onWsState(state));
    // A register that boots while the LAN is down is degraded immediately —
    // services will queue/cache before the first request even fires.
    this.probe();
  }

  stop(): void {
    this.started = false;
    this.unsubscribeConnection?.();
    this.unsubscribeConnection = null;
    this.stopProbing();
  }

  onStateChange(listener: (state: LanState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** Fires once per degraded → online transition. */
  onRecovery(listener: () => void): () => void {
    this.recoveryListeners.add(listener);
    return () => this.recoveryListeners.delete(listener);
  }

  /** Called by InstoreApiClient when any request succeeds. */
  noteRequestSuccess(): void {
    if (this.state === 'degraded') {
      this.logger.info('Store API reachable again — leaving degraded mode');
      this.setState('online');
    }
  }

  /** Called by InstoreApiClient when a request fails. */
  noteRequestFailure(error: unknown): void {
    if (!isStoreApiUnavailable(error)) return;
    this.markUnreachable();
  }

  private onWsState(state: ConnectionState): void {
    if (state === 'connected' || state === 'streaming') {
      this.noteRequestSuccess();
      return;
    }
    // 'disconnected' | 'reconnecting' — could be a blip; let the probe decide.
    this.probe();
  }

  private markUnreachable(): void {
    if (this.state === 'degraded') return;
    this.logger.warn('Store API unreachable — entering degraded mode');
    this.setState('degraded');
  }

  private setState(next: LanState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.stateListeners) {
      try {
        listener(next);
      } catch {
        // listener errors must not break the health loop
      }
    }
    if (next === 'degraded') {
      this.startProbing();
    } else {
      this.stopProbing();
      for (const listener of this.recoveryListeners) {
        try {
          listener();
        } catch (error) {
          this.logger.error({ message: 'Recovery listener failed' }, error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  }

  private startProbing(): void {
    if (this.probeTimer) return;
    this.probeTimer = setInterval(() => this.probe(), PROBE_INTERVAL_MS);
  }

  private stopProbing(): void {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
  }

  /** Unauthenticated health probe — /api/health answers without a signature. */
  private async probe(): Promise<void> {
    if (this.probing || !this.started) return;
    const baseUrl = instoreApiConfig.baseUrl;
    if (!baseUrl) return;
    this.probing = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`, { signal: controller.signal });
      if (response.ok) {
        this.noteRequestSuccess();
      } else {
        this.markUnreachable();
      }
    } catch {
      this.markUnreachable();
    } finally {
      clearTimeout(timeout);
      this.probing = false;
    }
  }
}

export const storeApiHealthService = StoreApiHealthService.getInstance();
