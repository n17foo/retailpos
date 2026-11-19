/**
 * InstoreApiPaymentService
 *
 * PaymentServiceInterface implementation that routes payments through the
 * store-api's payment orchestration layer. Used for PED providers that do
 * NOT have a React Native SDK (Worldpay, Worldline, Global Payments, Nexi,
 * Elavon, Fiserv, and Adyen Terminal API via Cloud).
 *
 * ADR-015: PED integration must go through the Instore API — never directly.
 *
 * This service:
 *   - Calls POST /api/payment-intents to initiate a payment on a PED terminal
 *   - Polls or listens via WebSocket for state transitions
 *   - Maps the orchestrator's PaymentIntent to the POS's PaymentResponse
 *   - Supports cancel, refund, and unknown-outcome recovery
 */

import { PaymentServiceInterface, PaymentRequest, PaymentResponse } from '../../../payments/services/PaymentServiceInterface';
import { paymentIntentClient } from './PaymentIntentClient';
import { storeApiWebSocket } from '../websocket/StoreApiWebSocket';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import type { PaymentIntent, PaymentIntentState } from './PaymentIntentTypes';
import { isTerminalState } from './PaymentIntentTypes';
import { toCents } from '../../../../shared/utils/money';

export interface InstoreApiPaymentConfig {
  /** PED provider name as registered in the store-api (e.g. 'worldpay', 'worldline', 'adyen') */
  provider: string;
  /** Terminal ID assigned by the provider */
  terminalId: string;
  /** Device ID for the PED (used for outbox routing) */
  pedDeviceId: string;
  /** Currency code (e.g. 'GBP', 'EUR') */
  currency: string;
  /** Whether to use WebSocket for real-time updates (falls back to polling) */
  useWebSocket?: boolean;
  /** Polling interval when WS is not available (default 1500ms) */
  pollIntervalMs?: number;
  /** Maximum time to wait for a payment result (default 120s) */
  timeoutMs?: number;
}

export class InstoreApiPaymentService implements PaymentServiceInterface {
  private readonly logger = LoggerFactory.getInstance().createLogger('InstoreApiPaymentService');
  private config: InstoreApiPaymentConfig | null = null;
  private connected = false;
  private deviceId: string | null = null;

  constructor(config?: InstoreApiPaymentConfig) {
    if (config) {
      this.config = config;
    }
  }

  /**
   * Configure the service with a PED terminal.
   * Call this after the user selects a terminal in the settings UI.
   */
  configure(config: InstoreApiPaymentConfig): void {
    this.config = config;
    this.connected = false;
    this.deviceId = null;
  }

  // ── PaymentServiceInterface ─────────────────────────────────────────────────

  async connectToTerminal(deviceId: string): Promise<boolean> {
    if (!this.config) {
      this.logger.error('InstoreApiPaymentService not configured');
      return false;
    }

    try {
      // Verify the store-api is reachable and the terminal is not locked
      await paymentIntentClient.getOpenIntentsForOrder('__probe__').catch(() => []);
      // If we got here without error, the API is reachable
      this.connected = true;
      this.deviceId = deviceId;
      this.logger.info(`Connected to PED terminal via store-api: ${deviceId} (provider: ${this.config.provider})`);
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to store-api for PED payment', error instanceof Error ? error : new Error(String(error)));
      this.connected = false;
      return false;
    }
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.config || !this.connected) {
      return {
        success: false,
        errorMessage: 'Not connected to a PED terminal via store-api',
        timestamp: new Date(),
      };
    }

    // The intent id is durable evidence that a charge may exist — keep it
    // outside the try so a transport failure still hands it back (CHK-01).
    let paymentIntentId: string | undefined;
    try {
      // Initiate the payment via the store-api orchestrator
      const result = await paymentIntentClient.initiatePayment({
        order_id: request.orderId ?? request.reference,
        provider: this.config.provider,
        terminal_id: this.config.terminalId,
        ped_device_id: this.config.pedDeviceId,
        currency: request.currency ?? this.config.currency,
        amount_minor: toCents(request.amount),
        tip_minor: 0,
        surcharge_minor: 0,
      });

      paymentIntentId = result.payment_intent.payment_intent_id;
      request.onPaymentAttempt?.(paymentIntentId);
      this.logger.info(`Payment intent created: ${paymentIntentId}`);

      // Wait for terminal state via polling (WS delivery is handled separately
      // for real-time UI updates; here we need the final result).
      const finalIntent = await this.waitForTerminalState(paymentIntentId);

      return this.mapIntentToResponse(finalIntent);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Payment processing failed';
      this.logger.error(msg);
      // A timeout/transport failure after the intent was created is NOT a
      // confirmed decline — the charge outcome is genuinely unknown and the
      // caller must not retry blindly (CHK-01).
      return {
        success: false,
        outcome: 'unknown',
        transactionId: paymentIntentId,
        errorMessage: msg,
        errorCode: 'payment_error',
        timestamp: new Date(),
      };
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.deviceId = null;
  }

  isTerminalConnected(): boolean {
    return this.connected;
  }

  getConnectedDeviceId(): string | null {
    return this.deviceId;
  }

  async getAvailableTerminals(): Promise<Array<{ id: string; name: string }>> {
    // PED terminals are configured in the store-api's environment.
    // For now, return the configured terminal if set.
    if (this.config) {
      return [{ id: this.config.terminalId, name: `${this.config.provider} — ${this.config.terminalId}` }];
    }
    return [];
  }

  // ── Extended PED operations ─────────────────────────────────────────────────

  /**
   * Cancel an in-flight payment on the PED terminal.
   */
  async cancelActivePayment(paymentIntentId: string): Promise<PaymentResponse> {
    try {
      const result = await paymentIntentClient.cancelPayment(paymentIntentId);
      return this.mapIntentToResponse(result.payment_intent);
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Cancel failed',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Refund an approved payment.
   */
  async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    try {
      const result = await paymentIntentClient.refundPayment({
        payment_intent_id: transactionId,
        amount_minor: toCents(amount),
      });
      return this.mapIntentToResponse(result.payment_intent);
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Refund failed',
        timestamp: new Date(),
      };
    }
  }

  /**
   * PaymentServiceInterface recovery hook — the stored transaction id is the
   * payment-intent id. Unlike recoverPayment, transport errors propagate so
   * the caller can distinguish "server unreachable — outcome unknown" from
   * "processor confirmed the charge failed".
   */
  async getTransactionStatus(transactionId: string): Promise<PaymentResponse> {
    const result = await paymentIntentClient.recoverOutcome(transactionId);
    return this.mapIntentToResponse(result.payment_intent);
  }

  /**
   * Look up the riskiest payment intent recorded for an order — used when an
   * interrupted sale has no persisted transaction id. Returns null only when
   * the server confirms no possibly-live charge exists, i.e. every recorded
   * intent ended without approval (CHK-01).
   */
  async getOpenPaymentForOrder(orderId: string): Promise<PaymentResponse | null> {
    const intents = await paymentIntentClient.getIntentsForOrder(orderId);
    // Approved beats pending beats declined — surface the riskiest attempt.
    const approved = intents.find(i => i.state === 'approved');
    const live = intents.find(i => !isTerminalState(i.state));
    const candidate = approved ?? live;
    return candidate ? this.mapIntentToResponse(candidate) : null;
  }

  /**
   * Recover the outcome of a payment with unknown status.
   */
  async recoverPayment(paymentIntentId: string): Promise<PaymentResponse> {
    try {
      const result = await paymentIntentClient.recoverOutcome(paymentIntentId);
      return this.mapIntentToResponse(result.payment_intent);
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Recovery failed',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get the receipt for a completed payment.
   */
  async getReceipt(paymentIntentId: string, copy: 'merchant' | 'customer' | 'both' = 'both') {
    return paymentIntentClient.getReceipt(paymentIntentId, copy);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  /**
   * Wait for a payment intent to reach a terminal state.
   * Uses WebSocket events when available, falls back to polling.
   */
  private async waitForTerminalState(paymentIntentId: string): Promise<PaymentIntent> {
    const useWs = this.config?.useWebSocket && storeApiWebSocket.state === 'streaming';

    if (useWs) {
      return this.waitViaWebSocket(paymentIntentId);
    }

    return paymentIntentClient.pollUntilTerminal(paymentIntentId, {
      intervalMs: this.config?.pollIntervalMs ?? 1500,
      timeoutMs: this.config?.timeoutMs ?? 120_000,
      onStateChange: intent => {
        this.logger.info(`Payment ${paymentIntentId} → ${intent.state}`);
      },
    });
  }

  /**
   * Listen for payment state changes via WebSocket outbox messages.
   */
  private waitViaWebSocket(paymentIntentId: string): Promise<PaymentIntent> {
    const timeoutMs = this.config?.timeoutMs ?? 120_000;

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        // Timeout — fall back to a single poll to get final state
        paymentIntentClient.getPaymentIntent(paymentIntentId).then(resolve).catch(reject);
      }, timeoutMs);

      const handler = (event: { type: string; data: { type: string; payload?: unknown } }) => {
        if (resolved) return;
        const msg = event.data;
        if (!msg.type?.startsWith('payment.')) return;

        // Check if the payload contains our payment intent
        const payload = msg.payload as Record<string, unknown> | undefined;
        if (payload?.payment_intent_id !== paymentIntentId) return;

        const state = payload.state as string;
        if (state && isTerminalState(state as PaymentIntentState)) {
          resolved = true;
          cleanup();
          // Fetch the full intent for a complete response
          paymentIntentClient.getPaymentIntent(paymentIntentId).then(resolve).catch(reject);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        storeApiWebSocket.off('message', handler);
      };

      storeApiWebSocket.on('message', handler);
    });
  }

  /**
   * Map a PaymentIntent from the store-api to the POS PaymentResponse shape.
   */
  private mapIntentToResponse(intent: PaymentIntent): PaymentResponse {
    const success = intent.state === 'approved';
    // Model the outcome explicitly (CHK-01): terminal non-approved states are
    // confirmed declines; anything still in flight is genuinely unknown —
    // the charge may already exist at the provider.
    const outcome = success ? 'approved' : isTerminalState(intent.state) ? 'declined' : 'unknown';

    return {
      success,
      outcome,
      transactionId: intent.payment_intent_id,
      receiptNumber: intent.approval_code ?? undefined,
      timestamp: new Date(intent.updated_at),
      amount: intent.approved_minor ?? intent.amount_minor,
      paymentMethod: intent.provider,
      cardBrand: intent.card_brand ?? undefined,
      last4: intent.card_last4 ?? undefined,
      errorMessage: success ? undefined : (intent.result_message ?? `Payment ${intent.state}`),
      errorCode: success ? undefined : (intent.result_code ?? intent.state),
    };
  }
}
