// Common payment interfaces that all payment providers will implement

export interface PaymentRequest {
  amount: number;
  reference: string;
  currency: string; // ISO currency code of the sale (e.g. 'GBP'); always the store's configured currency
  orderId?: string; // Optional order identifier
  customerName?: string; // Optional customer name for receipt
  itemCount?: number; // Number of items in the transaction
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  /**
   * Called the moment the provider has assigned a durable attempt id
   * (payment-intent id, processor transaction id) — before the outcome is
   * known. Callers must persist it so an interruption can never lose the
   * evidence that a charge may exist (CHK-01).
   */
  onPaymentAttempt?: (transactionId: string) => void;
}

/** 'unknown' — the provider cannot confirm the charge did not happen; retrying may double-charge. */
export type PaymentOutcome = 'approved' | 'declined' | 'unknown';

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  receiptNumber?: string;
  errorMessage?: string;
  errorCode?: string; // Error code for specific error handling (e.g. 'card_declined')
  /**
   * Normalised outcome (CHK-01). Absent ⇒ infer from `success`
   * (legacy providers). 'unknown' must never be treated as a decline.
   */
  outcome?: PaymentOutcome;
  timestamp: Date;
  amount?: number; // Amount for refund or payment transactions
  paymentMethod?: string; // Method used for payment (e.g. 'contactless', 'chip')
  cardBrand?: string; // Brand of card used (e.g. 'Visa', 'Mastercard')
  last4?: string; // Last 4 digits of payment card
}

/**
 * Common interface for all payment service providers
 * This ensures all payment services implement the same methods
 */
export interface PaymentServiceInterface {
  // Connect to a payment terminal
  connectToTerminal(deviceId: string): Promise<boolean>;

  // Process a payment
  processPayment(request: PaymentRequest): Promise<PaymentResponse>;

  // Disconnect from terminal
  disconnect(): Promise<void> | void;

  // Check if connected to a terminal
  isTerminalConnected(): boolean;

  // Get ID of connected device
  getConnectedDeviceId(): string | null;

  // Get available payment terminals
  getAvailableTerminals(): Promise<Array<{ id: string; name: string }>>;

  // Transaction operations
  getTransactionStatus?(transactionId: string): Promise<PaymentResponse>;
  voidTransaction?(transactionId: string): Promise<PaymentResponse>;
  refundTransaction?(transactionId: string, amount: number): Promise<PaymentResponse>;

  /**
   * Look up a possibly-live charge for an order when no transaction id was
   * persisted locally (e.g. the app died before the response arrived).
   * Returns the highest-risk known attempt, or null when the provider
   * confirms no charge exists — only then is a retry safe (CHK-01).
   */
  getOpenPaymentForOrder?(orderId: string): Promise<PaymentResponse | null>;
}
