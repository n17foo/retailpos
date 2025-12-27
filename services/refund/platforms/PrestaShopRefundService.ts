import { PlatformRefundServiceInterface } from './platformRefundServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../refundServiceInterface';
import { LoggerFactory } from '../../logger';

/**
 * PrestaShop-specific implementation of the refund service
 * Handles refunds for PrestaShop orders
 */
export class PrestaShopRefundService implements PlatformRefundServiceInterface {
  private initialized: boolean = false;
  private refundHistory: Map<string, RefundRecord[]> = new Map();
  private logger = LoggerFactory.getInstance().createLogger('PrestaShopRefundService');

  /**
   * Initialize the PrestaShop refund service
   */
  async initialize(): Promise<boolean> {
    try {
      // Initialize directly without depending on the e-commerce factory
      // Check for credentials availability (mock implementation)
      this.initialized = true;
      this.logger.info('PrestaShop refund service initialized (mock implementation)');
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing PrestaShop refund service' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.initialized = false;
      return false;
    }
  }

  /**
   * Process a refund for a PrestaShop order
   * @param orderId The PrestaShop order ID to refund
   * @param refundData Details about the refund
   */
  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      if (!this.isInitialized()) {
        throw new Error('PrestaShop refund service not initialized');
      }

      this.logger.info(`Processing PrestaShop refund for order: ${orderId}`);

      // Mock refund processing for PrestaShop
      const refundId = `prestashop-refund-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // If successful, record the refund in history
      const refundRecord: RefundRecord = {
        id: refundId,
        orderId,
        amount: refundData.amount || 0,
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
        amount: refundData.amount || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error({ message: 'Error processing PrestaShop refund' }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get refund history for a PrestaShop order
   * @param orderId The order ID to get refund history for
   */
  async getRefundHistory(orderId: string): Promise<RefundRecord[]> {
    return this.refundHistory.get(orderId) || [];
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Add a refund record to the history
   */
  private addRefundToHistory(orderId: string, refund: RefundRecord): void {
    const history = this.refundHistory.get(orderId) || [];
    history.push(refund);
    this.refundHistory.set(orderId, history);
  }
}
