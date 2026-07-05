/**
 * PaymentIntentClient
 *
 * HTTP client for the store-api's payment orchestration endpoints.
 * Used when a POS register needs to initiate, monitor, cancel, refund,
 * or recover PED (PIN Entry Device) payments through the integration-hub
 * rather than via a local SDK.
 *
 * This implements ADR-015: all non-SDK PED integrations (Worldpay, Worldline,
 * Adyen Terminal API, Global Payments, Nexi, Elavon, Fiserv) go through the
 * Instore API — never as a direct PaymentProvider in the POS client.
 *
 * Endpoint summary:
 *   POST   /api/payment-intents                     — initiate payment
 *   GET    /api/payment-intents/:id                 — get payment intent
 *   PUT    /api/payment-intents/:id/state           — update state (webhook)
 *   POST   /api/payment-intents/:id/cancel          — cancel in-flight payment
 *   POST   /api/payment-intents/:id/refund          — refund approved payment
 *   POST   /api/payment-intents/:id/recover         — recover unknown outcome
 *   GET    /api/payment-intents/:id/receipt          — get receipt
 *   POST   /api/payment-intents/:id/receipt/reprint  — reprint receipt
 *   GET    /api/payment-intents/order/:order_id     — list intents for an order
 */

import { instoreApiConfig } from '../InstoreApiConfig';
import { LoggerFactory } from '../../logger/LoggerFactory';
import type {
  PaymentIntent,
  InitiatePaymentInput,
  InitiatePaymentResult,
  CancelPaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  RecoverOutcomeResult,
  ReceiptCopy,
  ReceiptResponse,
  ReprintRequest,
} from './PaymentIntentTypes';

export class PaymentIntentClient {
  private static instance: PaymentIntentClient;
  private logger = LoggerFactory.getInstance().createLogger('PaymentIntentClient');

  private constructor() {}

  static getInstance(): PaymentIntentClient {
    if (!PaymentIntentClient.instance) {
      PaymentIntentClient.instance = new PaymentIntentClient();
    }
    return PaymentIntentClient.instance;
  }

  // ── Initiate ────────────────────────────────────────────────────────────────

  /**
   * Initiate a new PED payment. The store-api will:
   *   1. Create a payment_intent in the DB
   *   2. Acquire a terminal lock (one active payment per PED)
   *   3. Send the payment request to the provider
   *   4. Enqueue an outbox message for real-time WS delivery
   *
   * @throws Error if the terminal is locked, order_id is missing, or provider is unavailable.
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    this.logger.info(
      `Initiating PED payment: provider=${input.provider}, terminal=${input.terminal_id}, ` +
        `amount=${input.amount_minor} ${input.currency}`
    );
    return this.post<InitiatePaymentResult>('/api/payment-intents', input);
  }

  // ── Query ───────────────────────────────────────────────────────────────────

  /**
   * Get the current state of a payment intent.
   */
  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    const result = await this.get<{ payment_intent: PaymentIntent }>(`/api/payment-intents/${paymentIntentId}`);
    return result.payment_intent;
  }

  /**
   * List all open (non-terminal) payment intents for an order.
   * Useful for checking if there's already an active payment before initiating.
   */
  async getOpenIntentsForOrder(orderId: string): Promise<PaymentIntent[]> {
    const result = await this.get<{ payment_intents: PaymentIntent[] }>(`/api/payment-intents/order/${orderId}`);
    return result.payment_intents ?? [];
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────

  /**
   * Cancel an in-flight payment (states: created, sent_to_terminal, waiting_for_cardholder).
   * The store-api will send a cancel request to the provider and release the terminal lock.
   */
  async cancelPayment(paymentIntentId: string): Promise<CancelPaymentResult> {
    this.logger.info(`Cancelling payment: ${paymentIntentId}`);
    return this.post<CancelPaymentResult>(`/api/payment-intents/${paymentIntentId}/cancel`, {});
  }

  // ── Refund ──────────────────────────────────────────────────────────────────

  /**
   * Refund an approved payment. Pass amount_minor = 0 for a full refund.
   */
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.logger.info(`Refunding payment: ${input.payment_intent_id}, amount=${input.amount_minor ?? 'full'}`);
    return this.post<RefundPaymentResult>(`/api/payment-intents/${input.payment_intent_id}/refund`, {
      amount_minor: input.amount_minor ?? 0,
      reason: input.reason,
    });
  }

  // ── Recovery ────────────────────────────────────────────────────────────────

  /**
   * Recover the outcome of a payment in `unknown_requires_recovery` state.
   * The store-api queries the provider using the merchant transaction reference
   * and resolves the payment to its definitive state.
   */
  async recoverOutcome(paymentIntentId: string): Promise<RecoverOutcomeResult> {
    this.logger.info(`Recovering payment outcome: ${paymentIntentId}`);
    return this.post<RecoverOutcomeResult>(`/api/payment-intents/${paymentIntentId}/recover`, {});
  }

  // ── Receipt ─────────────────────────────────────────────────────────────────

  /**
   * Get the stored receipt for a payment intent.
   */
  async getReceipt(paymentIntentId: string, copy: ReceiptCopy = 'both'): Promise<ReceiptResponse> {
    return this.get<ReceiptResponse>(`/api/payment-intents/${paymentIntentId}/receipt`, { copy });
  }

  /**
   * Request a receipt reprint. May query the provider if supported.
   */
  async reprintReceipt(paymentIntentId: string, copy: ReceiptCopy = 'both'): Promise<ReceiptResponse> {
    const request: ReprintRequest = { payment_intent_id: paymentIntentId, copy };
    return this.post<ReceiptResponse>(`/api/payment-intents/${paymentIntentId}/receipt/reprint`, request);
  }

  // ── Polling helper ──────────────────────────────────────────────────────────

  /**
   * Poll a payment intent until it reaches a terminal state or timeout.
   * Useful as a fallback when WebSocket delivery is not available.
   *
   * @param paymentIntentId - The payment intent to poll
   * @param intervalMs - Polling interval (default 1500ms)
   * @param timeoutMs - Maximum wait time (default 120s)
   * @param onStateChange - Callback for each state transition observed
   */
  async pollUntilTerminal(
    paymentIntentId: string,
    options?: {
      intervalMs?: number;
      timeoutMs?: number;
      onStateChange?: (intent: PaymentIntent) => void;
    }
  ): Promise<PaymentIntent> {
    const { intervalMs = 1500, timeoutMs = 120_000, onStateChange } = options ?? {};
    const startedAt = Date.now();
    let lastState = '';

    while (Date.now() - startedAt < timeoutMs) {
      const intent = await this.getPaymentIntent(paymentIntentId);

      if (intent.state !== lastState) {
        lastState = intent.state;
        onStateChange?.(intent);
      }

      if (this.isTerminalState(intent.state)) {
        return intent;
      }

      await this.sleep(intervalMs);
    }

    // Timeout — return the last known state
    this.logger.warn(`Payment intent ${paymentIntentId} did not reach terminal state within ${timeoutMs}ms`);
    return this.getPaymentIntent(paymentIntentId);
  }

  // ── Private HTTP helpers ────────────────────────────────────────────────────

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Register-Id': instoreApiConfig.current.registerId,
    };
    const secret = instoreApiConfig.current.sharedSecret;
    if (secret) {
      h['x-shared-secret'] = secret;
    }
    return h;
  }

  private get baseUrl(): string {
    return instoreApiConfig.baseUrl;
  }

  private async get<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (queryParams) {
      const qs = new URLSearchParams(queryParams).toString();
      url += `?${qs}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const msg = (errorBody as Record<string, string>).error || `GET ${path} failed: ${response.status}`;
      throw new Error(msg);
    }

    return response.json();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const msg = (errorBody as Record<string, string>).error || `POST ${path} failed: ${response.status}`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    return response.json();
  }

  private isTerminalState(state: string): boolean {
    return ['approved', 'declined', 'cancelled', 'failed', 'reversed', 'refunded'].includes(state);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const paymentIntentClient = PaymentIntentClient.getInstance();
