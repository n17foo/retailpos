import { RefundServiceInterface, RefundData, RefundResult, RefundRecord } from '../refundServiceInterface';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock implementation of the Refund Service for testing
 * Simulates refunds for both eCommerce and payment terminals
 */
export class RefundMockService implements RefundServiceInterface {
  private initialized: boolean = false;
  private refundHistory: Map<string, RefundRecord[]> = new Map();

  /**
   * Initialize the mock refund service
   */
  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Process a mock refund for an e-commerce order
   */
  async processEcommerceRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    // Simulate a delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const refundId = uuidv4();
    const refundAmount = refundData.amount || 0;

    // Create refund record
    const refundRecord: RefundRecord = {
      id: refundId,
      orderId,
      amount: refundAmount,
      items: refundData.items?.map(item => ({
        lineItemId: item.lineItemId,
        quantity: item.quantity,
        amount: item.amount || 0,
      })),
      reason: refundData.reason,
      note: refundData.note,
      status: 'completed',
      source: 'ecommerce',
      timestamp: new Date(),
    };

    this.addRefundToHistory(orderId, refundRecord);

    return {
      success: true,
      refundId,
      amount: refundAmount,
      timestamp: new Date(),
    };
  }

  /**
   * Process a mock refund for a payment transaction
   */
  async processPaymentRefund(transactionId: string, amount: number, reason?: string): Promise<RefundResult> {
    // Simulate a delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const refundId = uuidv4();

    // Create refund record
    const refundRecord: RefundRecord = {
      id: refundId,
      orderId: transactionId,
      transactionId: refundId,
      amount: amount,
      reason: reason,
      status: 'completed',
      source: 'payment_terminal',
      timestamp: new Date(),
    };

    this.addRefundToHistory(transactionId, refundRecord);

    return {
      success: true,
      refundId,
      amount: amount,
      timestamp: new Date(),
    };
  }

  /**
   * Get refund history for an order
   */
  async getRefundHistory(orderId: string): Promise<RefundRecord[]> {
    return this.refundHistory.get(orderId) || [];
  }

  /**
   * Add a refund record to the history
   * @private
   */
  private addRefundToHistory(orderId: string, refund: RefundRecord): void {
    const history = this.refundHistory.get(orderId) || [];
    history.push(refund);
    this.refundHistory.set(orderId, history);
  }
}
