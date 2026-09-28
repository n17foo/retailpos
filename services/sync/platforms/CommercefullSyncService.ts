/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BasePlatformSyncService } from './BasePlatformSyncService';
import { PlatformSyncConfig, PlatformSyncConfigRequirements } from './PlatformSyncServiceInterface';
import { SyncOptions, SyncOperationResult, SyncEntityType } from '../SyncServiceInterface';
import { CommercefullApiClient, CommercefullConfig } from '../../clients/commercefull/CommercefullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { hmacSha256Hex, timingSafeEqual } from '../../../utils/crypto';

/**
 * Webhook event payload received from Commercefull
 */
export interface CommercefullWebhookEvent {
  event: string;
  data: any;
  timestamp: string;
  deliveryId: string;
}

/**
 * Listener callback for real-time webhook events
 */
export type WebhookEventListener = (event: CommercefullWebhookEvent) => void | Promise<void>;

/**
 * Commercefull platform implementation of the sync service.
 *
 * Supports both pull-based sync and real-time push via webhooks:
 *   GET    /health                       → testConnection
 *   POST   /business/webhooks            → registerSyncWebhooks
 *   DELETE /business/webhooks/:id        → unregisterSyncWebhooks
 *   GET    /business/products            → syncProducts (pull)
 *   GET    /business/inventory/items     → syncInventory (pull)
 *   GET    /business/orders              → syncOrders (pull)
 *   GET    /business/customers           → syncCustomers (pull)
 *   GET    /customer/categories          → syncCategories (pull)
 */
export class CommercefullSyncService extends BasePlatformSyncService {
  private apiClient: CommercefullApiClient;
  private webhookEndpointId: string | null = null;
  private webhookSecret: string | null = null;
  private webhookListeners: Map<string, WebhookEventListener[]> = new Map();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('CommercefullSyncService');
    this.apiClient = CommercefullApiClient.getInstance();
  }

  getConfigRequirements(): PlatformSyncConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey', 'apiSecret'],
      optional: ['apiVersion', 'syncInterval', 'batchSize', 'webhookUrl'],
    };
  }

  async initialize(config: PlatformSyncConfig): Promise<boolean> {
    try {
      this.config = { ...config };

      const clientConfig: CommercefullConfig = {
        storeUrl: config.storeUrl,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        apiVersion: config.apiVersion,
      };

      this.apiClient.configure(clientConfig);
      const ok = await this.apiClient.initialize();
      if (ok) this.initialized = true;
      return ok;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Commercefull sync service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.apiClient.get('/health');
      return true;
    } catch (error) {
      this.logger.error({ message: 'Commercefull connection test failed' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  // ===========================================================================
  // Webhook Registration (Real-time Sync)
  // ===========================================================================

  /**
   * Register webhooks on Commercefull for real-time event push.
   * Creates a single webhook endpoint that subscribes to all sync-relevant events.
   */
  async registerSyncWebhooks(webhookUrl: string): Promise<boolean> {
    if (!this.isInitialized()) {
      this.logger.error({ message: 'Cannot register webhooks: service not initialized' });
      return false;
    }

    try {
      const data = await this.apiClient.post<any>('/business/webhooks', {
        name: 'RetailPOS Real-time Sync',
        url: webhookUrl,
        events: ['product.*', 'order.*', 'inventory.*', 'customer.*'],
        retryPolicy: {
          maxRetries: 5,
          retryIntervalMs: 5000,
          backoffMultiplier: 2,
        },
      });

      const result = data.data || data;
      this.webhookEndpointId = result.webhookEndpointId || result.id;
      this.webhookSecret = result.secret;

      this.logger.info({
        message: `Registered Commercefull webhook: ${this.webhookEndpointId}`,
      });

      return !!this.webhookEndpointId;
    } catch (error) {
      this.logger.error({ message: 'Failed to register Commercefull webhooks' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Unregister the previously registered webhook endpoint.
   */
  async unregisterSyncWebhooks(): Promise<boolean> {
    if (!this.isInitialized() || !this.webhookEndpointId) {
      return false;
    }

    try {
      await this.apiClient.delete(`/business/webhooks/${this.webhookEndpointId}`);
      this.logger.info({
        message: `Unregistered Commercefull webhook: ${this.webhookEndpointId}`,
      });
      this.webhookEndpointId = null;
      this.webhookSecret = null;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to unregister Commercefull webhooks' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Get the webhook secret used for HMAC signature verification.
   */
  getWebhookSecret(): string | null {
    return this.webhookSecret;
  }

  /**
   * Get the registered webhook endpoint ID.
   */
  getWebhookEndpointId(): string | null {
    return this.webhookEndpointId;
  }

  // ===========================================================================
  // Webhook Event Handling
  // ===========================================================================

  /**
   * Register a listener for a specific event type (or '*' for all).
   */
  onWebhookEvent(eventType: string, listener: WebhookEventListener): void {
    if (!this.webhookListeners.has(eventType)) {
      this.webhookListeners.set(eventType, []);
    }
    this.webhookListeners.get(eventType)!.push(listener);
  }

  /**
   * Remove a listener for a specific event type.
   */
  offWebhookEvent(eventType: string, listener: WebhookEventListener): void {
    const listeners = this.webhookListeners.get(eventType);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
    }
  }

  /**
   * Process an incoming webhook event from Commercefull.
   * Called by the webhook receiver endpoint when a POST is received.
   */
  async handleWebhookEvent(event: CommercefullWebhookEvent): Promise<void> {
    this.logger.info({
      message: `Received webhook event: ${event.event} (delivery: ${event.deliveryId})`,
    });

    // Notify specific event listeners
    const specificListeners = this.webhookListeners.get(event.event) || [];
    for (const listener of specificListeners) {
      try {
        await listener(event);
      } catch (error) {
        this.logger.error(
          { message: `Error in webhook listener for ${event.event}` },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.webhookListeners.get('*') || [];
    for (const listener of wildcardListeners) {
      try {
        await listener(event);
      } catch (error) {
        this.logger.error(
          { message: `Error in wildcard webhook listener for ${event.event}` },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    // Notify category listeners (e.g. "product.*" matches "product.created")
    const category = event.event.split('.')[0];
    const categoryWildcard = `${category}.*`;
    const categoryListeners = this.webhookListeners.get(categoryWildcard) || [];
    for (const listener of categoryListeners) {
      try {
        await listener(event);
      } catch (error) {
        this.logger.error(
          { message: `Error in category webhook listener for ${categoryWildcard}` },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  /**
   * Verify HMAC-SHA256 signature from an incoming webhook request.
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn({ message: 'No webhook secret available for signature verification' });
      return false;
    }

    // Pure-TS HMAC-SHA256 — works on React Native where Node's crypto module
    // is unavailable. Never skip verification when the runtime lacks crypto.
    const expected = hmacSha256Hex(this.webhookSecret, body);
    // Tolerate a 'sha256=' prefix (same convention as the platform's own adapters)
    const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    return timingSafeEqual(expected, provided);
  }

  // ===========================================================================
  // Pull-based Sync (Fallback / Initial Load)
  // ===========================================================================

  /**
   * Execute the actual sync operation — called by BaseSyncService.startSync()
   */
  protected async executeSyncOperation(syncId: string, options: SyncOptions): Promise<void> {
    const startTime = Date.now();
    const result: SyncOperationResult = {
      entityType: options.entityType,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      completedAt: new Date(),
      durationMs: 0,
    };

    const entities =
      options.entityType === SyncEntityType.ALL
        ? [SyncEntityType.PRODUCT, SyncEntityType.INVENTORY, SyncEntityType.ORDER, SyncEntityType.CUSTOMER]
        : [options.entityType];

    this.updateSyncProgress(syncId, 0, entities.length);

    let progress = 0;
    for (const entity of entities) {
      try {
        await this.syncEntity(entity);
        result.successful++;
      } catch (error) {
        if (options.skipErrors) {
          result.failed++;
          result.errors.push({
            entityId: entity,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        } else {
          throw error;
        }
      }
      progress++;
      this.updateSyncProgress(syncId, progress, entities.length);
    }

    result.durationMs = Date.now() - startTime;
    result.completedAt = new Date();
    this.completeSyncOperation(syncId, result);
  }

  private async syncEntity(entity: SyncEntityType): Promise<void> {
    switch (entity) {
      case SyncEntityType.PRODUCT:
        await this.apiClient.get('/business/products', { limit: '100' });
        this.logger.info({ message: 'Synced products from Commercefull' });
        break;
      case SyncEntityType.INVENTORY:
        await this.apiClient.get('/business/inventory/items', { limit: '100' });
        this.logger.info({ message: 'Synced inventory from Commercefull' });
        break;
      case SyncEntityType.ORDER:
        await this.apiClient.get('/business/orders', { limit: '50' });
        this.logger.info({ message: 'Synced orders from Commercefull' });
        break;
      case SyncEntityType.CUSTOMER:
        await this.apiClient.get('/business/customers', { limit: '100' });
        this.logger.info({ message: 'Synced customers from Commercefull' });
        break;
      case SyncEntityType.CATEGORY:
        await this.apiClient.get('/customer/categories');
        this.logger.info({ message: 'Synced categories from Commercefull' });
        break;
      default:
        this.logger.warn({ message: `Unknown entity type for sync: ${entity}` });
    }
  }
}
