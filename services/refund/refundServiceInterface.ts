/**
 * Interface for all refund services
 * Provides common methods for processing refunds across different platforms and payment providers
 */
export interface RefundServiceInterface {
  /**
   * Initialize the refund service
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   * @returns Boolean indicating if the service is ready
   */
  isInitialized(): boolean;

  /**
   * Process a refund for an e-commerce order
   * @param orderId The platform order ID to refund
   * @param refundData Details about the refund
   * @returns Promise resolving to the refund result
   */
  processEcommerceRefund(orderId: string, refundData: RefundData): Promise<RefundResult>;

  /**
   * Process a refund for a payment transaction
   * @param transactionId The payment transaction ID to refund
   * @param amount The amount to refund
   * @param reason Optional reason for the refund
   * @returns Promise resolving to the refund result
   */
  processPaymentRefund(transactionId: string, amount: number, reason?: string): Promise<RefundResult>;

  /**
   * Get refund history for an order
   * @param orderId The order ID to get refund history for
   * @returns Promise resolving to list of refunds for the order
   */
  getRefundHistory(orderId: string): Promise<RefundRecord[]>;
}

/**
 * Data for processing a refund
 */
export interface RefundData {
  items?: Array<{
    lineItemId: string;
    quantity: number;
    amount?: number;
    restockInventory?: boolean;
  }>;
  amount?: number; // For partial refunds of a specific amount
  reason?: string;
  note?: string;
}

/**
 * Result of a refund operation
 */
export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Record of a refund transaction
 */
export interface RefundRecord {
  id: string;
  orderId: string;
  transactionId?: string;
  amount: number;
  items?: Array<{
    lineItemId: string;
    quantity: number;
    amount: number;
  }>;
  reason?: string;
  note?: string;
  status: 'pending' | 'completed' | 'failed';
  source: 'ecommerce' | 'payment_terminal';
  timestamp: Date;
}
