/**
 * Payment Intent Types
 *
 * TypeScript representations of the integration-hub's payment orchestration
 * domain types. These map 1:1 to the Go types in pkg/payment/.
 *
 * These types are used by the PaymentIntentClient to communicate with the
 * store-api's `/api/payment-intents` endpoints for PED (PIN Entry Device)
 * payment orchestration.
 */

// ─── Payment Intent State Machine ─────────────────────────────────────────────

/**
 * All valid states a payment intent can be in.
 * Must stay in sync with pkg/payment/state.go in integration-hub.
 */
export type PaymentIntentState =
  // Active states — terminal is busy
  | 'created'
  | 'sent_to_terminal'
  | 'waiting_for_cardholder'
  | 'authorising'
  // Recovery state — outcome unknown
  | 'unknown_requires_recovery'
  // Terminal states — payment is settled or ended
  | 'approved'
  | 'declined'
  | 'cancelled'
  | 'failed'
  | 'reversed'
  | 'refunded';

/** States where the terminal is busy and new payments are blocked. */
export const ACTIVE_STATES: PaymentIntentState[] = [
  'created',
  'sent_to_terminal',
  'waiting_for_cardholder',
  'authorising',
  'unknown_requires_recovery',
];

/** States where no further transitions are possible. */
export const TERMINAL_STATES: PaymentIntentState[] = ['approved', 'declined', 'cancelled', 'failed', 'reversed', 'refunded'];

export function isTerminalState(state: PaymentIntentState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function isActiveState(state: PaymentIntentState): boolean {
  return ACTIVE_STATES.includes(state);
}

// ─── Payment Intent ───────────────────────────────────────────────────────────

export interface PaymentIntent {
  payment_intent_id: string;
  order_id: string;
  attempt_no: number;
  idempotency_key: string;
  merchant_transaction_reference: string;
  provider: string;
  provider_account?: string | null;
  terminal_id?: string | null;
  ped_device_id?: string | null;
  state: PaymentIntentState;
  currency: string;
  amount_minor: number;
  tip_minor: number;
  surcharge_minor: number;
  approved_minor?: number | null;
  requested_at: string;
  sent_to_terminal_at?: string | null;
  authorised_at?: string | null;
  captured_at?: string | null;
  voided_at?: string | null;
  failed_at?: string | null;
  recovery_started_at?: string | null;
  expires_at?: string | null;
  processor_intent_ref?: string | null;
  processor_txn_ref?: string | null;
  approval_code?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  result_code?: string | null;
  result_message?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── API Input/Output Types ───────────────────────────────────────────────────

/** POST /api/payment-intents — initiate a new payment */
export interface InitiatePaymentInput {
  order_id: string;
  provider: string;
  terminal_id: string;
  ped_device_id: string;
  currency: string;
  amount_minor: number;
  tip_minor?: number;
  surcharge_minor?: number;
  expires_at?: string;
  metadata?: Record<string, string>;
}

export interface InitiatePaymentResult {
  payment_intent: PaymentIntent;
  outbox_seq: number;
}

/** PUT /api/payment-intents/:id/state — PED callback / provider webhook */
export interface UpdatePaymentStateInput {
  payment_intent_id: string;
  state: PaymentIntentState;
  approved_minor?: number;
  processor_intent_ref?: string;
  processor_txn_ref?: string;
  approval_code?: string;
  card_brand?: string;
  card_last4?: string;
  result_code?: string;
  result_message?: string;
}

/** POST /api/payment-intents/:id/cancel */
export interface CancelPaymentInput {
  payment_intent_id: string;
}

export interface CancelPaymentResult {
  payment_intent: PaymentIntent;
  outbox_seq: number;
}

/** POST /api/payment-intents/:id/refund */
export interface RefundPaymentInput {
  payment_intent_id: string;
  amount_minor?: number; // 0 or omitted = full refund
  reason?: string;
}

export interface RefundPaymentResult {
  payment_intent: PaymentIntent;
  refund_ref: string;
}

/** POST /api/payment-intents/:id/recover — unknown outcome recovery */
export interface RecoverOutcomeInput {
  payment_intent_id: string;
}

export interface RecoverOutcomeResult {
  payment_intent: PaymentIntent;
  resolved_state: PaymentIntentState;
  message: string;
}

// ─── Receipt Types ────────────────────────────────────────────────────────────

export type ReceiptCopy = 'merchant' | 'customer' | 'both';

export interface NormalisedReceipt {
  transaction_type: string;
  result: string;
  amount_minor: number;
  currency: string;
  masked_pan?: string;
  card_scheme?: string;
  auth_code?: string;
  provider_txn_id?: string;
  merchant_receipt_lines?: string[];
  customer_receipt_lines?: string[];
}

export interface ReceiptResponse {
  payment_intent_id: string;
  copy: ReceiptCopy;
  lines: string[];
}

/** POST /api/payment-intents/:id/receipt/reprint */
export interface ReprintRequest {
  payment_intent_id: string;
  copy: ReceiptCopy;
}
