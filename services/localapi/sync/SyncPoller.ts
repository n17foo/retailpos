import { localApiConfig } from '../LocalApiConfig';
import { localApiClient } from '../LocalApiClient';
import { syncEventBus } from './SyncEventBus';
import { SyncEvent } from './SyncEventTypes';
import { LoggerFactory } from '../../logger/loggerFactory';

/**
 * Polls the server register for new sync events.
 * Used by client registers to stay in sync with the server.
 * Falls back gracefully when the server is unreachable.
 */
export class SyncPoller {
  private static instance: SyncPoller;
  private logger = LoggerFactory.getInstance().createLogger('SyncPoller');
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTimestamp = 0;
  private pollIntervalMs = 3000;
  private running = false;
  private consecutiveErrors = 0;
  private readonly MAX_BACKOFF_MS = 30000;

  private constructor() {}

  static getInstance(): SyncPoller {
    if (!SyncPoller.instance) {
      SyncPoller.instance = new SyncPoller();
    }
    return SyncPoller.instance;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(intervalMs?: number): void {
    if (this.running) return;
    if (!localApiConfig.isClient) {
      this.logger.warn('SyncPoller only runs in client mode');
      return;
    }

    this.pollIntervalMs = intervalMs ?? 3000;
    this.running = true;
    this.consecutiveErrors = 0;
    this.lastTimestamp = Date.now() - 60000; // Start 1 minute back

    this.logger.info(`SyncPoller started (interval: ${this.pollIntervalMs}ms)`);
    this.schedulePoll();
  }

  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.logger.info('SyncPoller stopped');
  }

  private schedulePoll(): void {
    if (!this.running) return;

    // Exponential backoff on consecutive errors
    const delay =
      this.consecutiveErrors > 0
        ? Math.min(this.pollIntervalMs * Math.pow(2, this.consecutiveErrors), this.MAX_BACKOFF_MS)
        : this.pollIntervalMs;

    this.intervalId = setTimeout(async () => {
      await this.poll();
      this.schedulePoll();
    }, delay);
  }

  private async poll(): Promise<void> {
    try {
      const baseUrl = localApiConfig.baseUrl;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Register-Id': localApiConfig.current.registerId,
      };
      const secret = localApiConfig.current.sharedSecret;
      if (secret) headers['x-shared-secret'] = secret;

      const response = await fetch(`${baseUrl}/api/sync/events?since=${this.lastTimestamp}`, { method: 'GET', headers });

      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status}`);
      }

      const data = await response.json();
      const events: SyncEvent[] = data.events || [];

      if (events.length > 0) {
        this.logger.info(`Received ${events.length} sync event(s)`);
        for (const event of events) {
          syncEventBus.receive(event);
          if (event.timestamp > this.lastTimestamp) {
            this.lastTimestamp = event.timestamp;
          }
        }
      }

      this.consecutiveErrors = 0;
    } catch (error) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors <= 3) {
        this.logger.warn(`Poll error (attempt ${this.consecutiveErrors}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

export const syncPoller = SyncPoller.getInstance();
