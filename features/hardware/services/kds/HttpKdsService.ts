import { KdsServiceInterface, KdsOrder, KdsConnectionConfig, KdsDriverType, KdsStatusUpdate } from './KdsServiceInterface';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { formatEndpoint } from './KdsVendorPresets';

/**
 * HTTP-based KDS service.
 * Sends order tickets to a KDS endpoint via REST.
 * Compatible with Square KDS, custom Node/Express KDS servers, and most
 * cloud-based kitchen display systems that expose a REST API.
 *
 * Status updates are polled via vendor-specific endpoints with configurable intervals.
 */
export class HttpKdsService implements KdsServiceInterface {
  readonly driverType: KdsDriverType = 'http';
  private logger = LoggerFactory.getInstance().createLogger('HttpKdsService');
  private config: KdsConnectionConfig | null = null;
  private connected = false;
  private statusHandlers = new Map<string, (update: KdsStatusUpdate) => void>();
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastPollTimestamp = 0;

  async connect(config: KdsConnectionConfig): Promise<boolean> {
    try {
      this.config = config;

      if (!config.vendorPreset) {
        this.logger.error('No vendor preset configured for KDS');
        return false;
      }

      // Verify the endpoint is reachable using vendor-specific health endpoint
      const healthUrl = `${config.endpoint}${config.vendorPreset.endpoints.health}`;
      const response = await fetch(healthUrl, {
        headers: this.buildHeaders(),
      });
      this.connected = response.ok;
      if (this.connected) {
        this.logger.info(`Connected to ${config.vendorPreset.name} at ${config.endpoint}`);
        if (config.vendorPreset.supportsPolling) {
          this.startPolling();
        }
      }
      return this.connected;
    } catch (error) {
      this.logger.error({ message: 'Failed to connect to KDS' }, error instanceof Error ? error : new Error(String(error)));
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    this.connected = false;
    this.config = null;
    this.logger.info('Disconnected from KDS');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendOrder(order: KdsOrder): Promise<boolean> {
    if (!this.config?.endpoint || !this.config.vendorPreset) return false;
    try {
      const endpoint = formatEndpoint(this.config.vendorPreset.endpoints.sendOrder, {
        merchantId: this.config.merchantId,
      });
      const url = `${this.config.endpoint}${endpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(order),
      });
      if (!response.ok) {
        this.logger.warn({ message: `KDS rejected order ${order.orderId}: ${response.status}` });
      }
      return response.ok;
    } catch (error) {
      this.logger.error(
        { message: `Failed to send order ${order.orderId} to KDS` },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async recallOrder(orderId: string): Promise<boolean> {
    if (!this.config?.endpoint || !this.config.vendorPreset) return false;
    try {
      const endpoint = formatEndpoint(this.config.vendorPreset.endpoints.recallOrder, {
        orderId,
        merchantId: this.config.merchantId,
      });
      const url = `${this.config.endpoint}${endpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    if (!this.config?.endpoint || !this.config.vendorPreset) return false;
    try {
      const endpoint = formatEndpoint(this.config.vendorPreset.endpoints.cancelOrder, {
        orderId,
        merchantId: this.config.merchantId,
      });
      const url = `${this.config.endpoint}${endpoint}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.buildHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  onStatusUpdate(callback: (update: KdsStatusUpdate) => void): string {
    const id = `kds-handler-${Date.now()}`;
    this.statusHandlers.set(id, callback);
    return id;
  }

  offStatusUpdate(subscriptionId: string): void {
    this.statusHandlers.delete(subscriptionId);
  }

  // ── Polling ──────────────────────────────────────────────────────────

  private startPolling(): void {
    this.lastPollTimestamp = Date.now();
    const intervalMs = this.config?.pollIntervalMs ?? this.config?.vendorPreset?.defaultPollIntervalMs ?? 3000;
    this.pollIntervalId = setInterval(() => this.poll(), intervalMs);
    this.logger.info(`Started polling KDS updates every ${intervalMs}ms`);
  }

  private stopPolling(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.config?.endpoint || !this.config.vendorPreset || !this.connected) return;
    try {
      const endpoint = formatEndpoint(this.config.vendorPreset.endpoints.getUpdates, {
        timestamp: this.lastPollTimestamp,
        merchantId: this.config.merchantId,
      });
      const url = `${this.config.endpoint}${endpoint}`;

      const response = await fetch(url, {
        headers: this.buildHeaders(),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { updates: KdsStatusUpdate[] };
      for (const update of data.updates ?? []) {
        if (update.updatedAt > this.lastPollTimestamp) {
          this.lastPollTimestamp = update.updatedAt;
        }
        this.statusHandlers.forEach(handler => {
          try {
            handler(update);
          } catch {
            /* swallow */
          }
        });
      }
    } catch {
      // Poll errors are silent — connection loss is handled by isConnected()
    }
  }

  private buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config?.apiKey) h['Authorization'] = `Bearer ${this.config.apiKey}`;
    return h;
  }
}
