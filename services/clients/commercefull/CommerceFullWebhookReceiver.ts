/* eslint-disable @typescript-eslint/no-explicit-any -- raw webhook payload handling */
import { LoggerFactory } from '../../logger/LoggerFactory';
import { CommerceFullSyncService, CommerceFullWebhookEvent } from '../../sync/platforms/CommerceFullSyncService';

/**
 * Webhook receiver for CommerceFull real-time sync events.
 *
 * This service handles incoming HTTP POST requests from CommerceFull's
 * webhook dispatch system. It verifies the HMAC signature and delegates
 * event processing to the CommerceFullSyncService.
 *
 * Usage with a local API server or Express-like handler:
 *
 *   const receiver = CommerceFullWebhookReceiver.getInstance();
 *   receiver.setSyncService(syncService);
 *
 *   // In your route handler:
 *   const result = await receiver.handleRequest(rawBody, headers);
 *   // result.status is 200 or 401/400/500
 */
export class CommerceFullWebhookReceiver {
  private static instance: CommerceFullWebhookReceiver;
  private syncService: CommerceFullSyncService | null = null;
  private logger = LoggerFactory.getInstance().createLogger('CommerceFullWebhookReceiver');

  private constructor() {}

  static getInstance(): CommerceFullWebhookReceiver {
    if (!CommerceFullWebhookReceiver.instance) {
      CommerceFullWebhookReceiver.instance = new CommerceFullWebhookReceiver();
    }
    return CommerceFullWebhookReceiver.instance;
  }

  /**
   * Set the sync service that owns the webhook secret and event listeners.
   */
  setSyncService(service: CommerceFullSyncService): void {
    this.syncService = service;
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
  ): Promise<{ status: number; body: Record<string, any> }> {
    if (!this.syncService) {
      this.logger.error({ message: 'Webhook receiver has no sync service configured' });
      return { status: 500, body: { success: false, error: 'Webhook receiver not configured' } };
    }

    // Verify HMAC signature
    const signature = headers['x-webhook-signature'];
    if (signature) {
      const valid = this.syncService.verifyWebhookSignature(rawBody, signature);
      if (!valid) {
        this.logger.warn({ message: 'Webhook signature verification failed' });
        return { status: 401, body: { success: false, error: 'Invalid signature' } };
      }
    }

    // Parse body
    let event: CommerceFullWebhookEvent;
    try {
      const payload = JSON.parse(rawBody);
      event = {
        event: payload.event,
        data: payload.data,
        timestamp: payload.timestamp,
        deliveryId: payload.deliveryId || headers['x-webhook-delivery-id'] || 'unknown',
      };

      if (!event.event) {
        return { status: 400, body: { success: false, error: 'Missing event type' } };
      }
    } catch (error) {
      this.logger.error({ message: 'Failed to parse webhook body' }, error instanceof Error ? error : new Error(String(error)));
      return { status: 400, body: { success: false, error: 'Invalid JSON body' } };
    }

    // Process event asynchronously — respond immediately to avoid timeout
    this.syncService.handleWebhookEvent(event).catch(error => {
      this.logger.error(
        { message: `Error processing webhook event ${event.event}` },
        error instanceof Error ? error : new Error(String(error))
      );
    });

    return {
      status: 200,
      body: { success: true, received: event.event, deliveryId: event.deliveryId },
    };
  }
}
