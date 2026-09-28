import { LoggerFactory } from '../../logger/LoggerFactory';
import { WebhookDeliveryRepository, WebhookDeliveryStore } from '../../../repositories/WebhookDeliveryRepository';
import { CommercefullSyncService, CommercefullWebhookEvent } from '../../sync/platforms/CommercefullSyncService';
import { sha256Hex } from '../../../utils/crypto';

/**
 * Webhook receiver for Commercefull real-time sync events.
 *
 * This service handles incoming HTTP POST requests from Commercefull's
 * webhook dispatch system. It verifies the HMAC signature and delegates
 * event processing to the CommercefullSyncService.
 *
 * Usage with a local API server or Express-like handler:
 *
 *   const receiver = CommercefullWebhookReceiver.getInstance();
 *   receiver.setSyncService(syncService);
 *
 *   // In your route handler:
 *   const result = await receiver.handleRequest(rawBody, headers);
 *   // result.status is 200 or 401/400/500
 */
export class CommercefullWebhookReceiver {
  private static instance: CommercefullWebhookReceiver;
  private syncService: CommercefullSyncService | null = null;
  private logger = LoggerFactory.getInstance().createLogger('CommercefullWebhookReceiver');
  private deliveryStore: WebhookDeliveryStore;
  private static readonly DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60_000;
  private static readonly MAX_EVENT_AGE_MS = 5 * 60_000;

  private constructor(deliveryStore: WebhookDeliveryStore = new WebhookDeliveryRepository()) {
    this.deliveryStore = deliveryStore;
  }

  static getInstance(): CommercefullWebhookReceiver {
    if (!CommercefullWebhookReceiver.instance) {
      CommercefullWebhookReceiver.instance = new CommercefullWebhookReceiver();
    }
    return CommercefullWebhookReceiver.instance;
  }

  /**
   * Set the sync service that owns the webhook secret and event listeners.
   */
  setSyncService(service: CommercefullSyncService): void {
    this.syncService = service;
  }

  /** Replace the durable delivery store (used by tests and alternate runtimes). */
  setDeliveryStore(store: WebhookDeliveryStore): void {
    this.deliveryStore = store;
  }

  /**
   * Handle an incoming webhook HTTP request.
   *
   * @param rawBody  The raw request body as a string (for signature verification)
   * @param headers  The HTTP request headers
   * @returns An object with status code and response body to send back
   */
  async handleRequest(
    rawBody: string,
    headers: Record<string, string | undefined>
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    if (!this.syncService) {
      this.logger.error({ message: 'Webhook receiver has no sync service configured' });
      return { status: 500, body: { success: false, error: 'Webhook receiver not configured' } };
    }

    // Verify HMAC signature — always required. Without a shared webhook
    // secret there is nothing to verify against, so refuse the event rather
    // than process unauthenticated input.
    const secret = this.syncService.getWebhookSecret();
    if (!secret) {
      this.logger.error({ message: 'Webhook received but no webhook secret is configured' });
      return { status: 503, body: { success: false, error: 'Webhook secret not configured' } };
    }

    const normalizedHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
    const signature = normalizedHeaders['x-webhook-signature'];
    if (!signature) {
      this.logger.warn({ message: 'Webhook rejected — missing signature header' });
      return { status: 401, body: { success: false, error: 'Missing signature' } };
    }

    const valid = this.syncService.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      this.logger.warn({ message: 'Webhook signature verification failed' });
      return { status: 401, body: { success: false, error: 'Invalid signature' } };
    }

    // Parse body
    let event: CommercefullWebhookEvent;
    try {
      const payload: unknown = JSON.parse(rawBody);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { status: 400, body: { success: false, error: 'Invalid event payload' } };
      }
      const value = payload as Record<string, unknown>;
      if (typeof value.event !== 'string' || !value.event || !value.data || typeof value.data !== 'object' || Array.isArray(value.data)) {
        return { status: 400, body: { success: false, error: 'Invalid event payload' } };
      }
      const headerDeliveryId = normalizedHeaders['x-webhook-delivery-id'];
      const rawTimestamp = value.timestamp;
      const timestampMs =
        typeof rawTimestamp === 'number'
          ? rawTimestamp < 1_000_000_000_000
            ? rawTimestamp * 1000
            : rawTimestamp
          : Date.parse(String(rawTimestamp));
      event = {
        event: value.event,
        data: value.data,
        timestamp: Number.isFinite(timestampMs) ? new Date(timestampMs).toISOString() : '',
        deliveryId: typeof value.deliveryId === 'string' && value.deliveryId ? value.deliveryId : headerDeliveryId || 'unknown',
      };
    } catch (error) {
      this.logger.error({ message: 'Failed to parse webhook body' }, error instanceof Error ? error : new Error(String(error)));
      return { status: 400, body: { success: false, error: 'Invalid JSON body' } };
    }

    const now = Date.now();
    const eventTimestamp = Date.parse(event.timestamp);
    if (!Number.isFinite(eventTimestamp) || Math.abs(now - eventTimestamp) > CommercefullWebhookReceiver.MAX_EVENT_AGE_MS) {
      return { status: 400, body: { success: false, error: 'Invalid or stale event timestamp' } };
    }
    if (event.deliveryId.length > 256) {
      return { status: 400, body: { success: false, error: 'Invalid delivery identifier' } };
    }

    const provider = `commercefull:${this.syncService.getWebhookEndpointId() ?? 'default'}`;
    const deliveryIdentity = event.deliveryId === 'unknown' ? signature : event.deliveryId;
    const deliveryKey = sha256Hex(deliveryIdentity);

    let claim;
    try {
      await this.deliveryStore.purgeExpired(now);
      claim = await this.deliveryStore.claim(provider, deliveryKey);
    } catch (error) {
      this.logger.error({ message: 'Webhook delivery tracking unavailable' }, error instanceof Error ? error : new Error(String(error)));
      return { status: 503, body: { success: false, error: 'Delivery tracking unavailable' } };
    }

    if (claim === 'duplicate') {
      return { status: 200, body: { success: true, duplicate: true, deliveryId: event.deliveryId } };
    }
    if (claim === 'processing') {
      return { status: 409, body: { success: false, error: 'Delivery already processing' } };
    }

    try {
      await this.syncService.handleWebhookEvent(event);
      await this.deliveryStore.markCompleted(provider, deliveryKey, CommercefullWebhookReceiver.DELIVERY_RETENTION_MS);
      return {
        status: 200,
        body: { success: true, received: event.event, deliveryId: event.deliveryId },
      };
    } catch (error) {
      try {
        await this.deliveryStore.markFailed(provider, deliveryKey, CommercefullWebhookReceiver.DELIVERY_RETENTION_MS);
      } catch (markFailedError) {
        this.logger.error(
          { message: `Failed to mark webhook delivery ${event.deliveryId} as failed` },
          markFailedError instanceof Error ? markFailedError : new Error(String(markFailedError))
        );
      }
      this.logger.error(
        { message: `Error processing webhook event ${event.event}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return { status: 500, body: { success: false, error: 'Webhook processing failed' } };
    }
  }
}
