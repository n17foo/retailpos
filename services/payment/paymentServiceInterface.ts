// Common payment interfaces that all payment providers will implement

export interface PaymentRequest {
  amount: number;
  reference: string;
  currency?: string; // Currency code (e.g. 'usd', 'eur')
  orderId?: string; // Optional order identifier
  customerName?: string; // Optional customer name for receipt
  itemCount?: number; // Number of items in the transaction
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  receiptNumber?: string;
  errorMessage?: string;
  errorCode?: string; // Error code for specific error handling (e.g. 'card_declined')
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
  disconnect(): void;

  // Check if connected to a terminal
  isTerminalConnected(): boolean;

  // Get ID of connected device
  getConnectedDeviceId(): string | null;

  // Get available payment terminals
  getAvailableTerminals(): Promise<Array<{ id: string; name: string }>>;

  // Transaction operations
  getTransactionStatus?(transactionId: string): Promise<any>;
  voidTransaction?(transactionId: string): Promise<PaymentResponse>;
  refundTransaction?(transactionId: string, amount: number): Promise<PaymentResponse>;
}
