import { PlatformRefundServiceInterface } from './PlatformRefundServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../RefundService';
import { LoggerFactory } from '../../../../../shared/services/logger/LoggerFactory';

/**
 * Base abstract class for platform-specific refund service implementations.
 * Provides common functionality and enforces consistent patterns across all platforms.
 */
export abstract class BaseRefundService implements PlatformRefundServiceInterface {
  protected initialized = false;
  protected logger = LoggerFactory.getInstance().createLogger('BaseRefundService');

  /**
   * Initialize the refund service for the specific platform
   * Must be implemented by each platform
   */
  abstract initialize(): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Process a refund for an order on this specific platform
   * Must be implemented by each platform
   */
  abstract processRefund(orderId: string, refundData: RefundData): Promise<RefundResult>;

  /**
   * Get refund history for an order on this platform
   * Must be implemented by each platform
   */
  abstract getRefundHistory(orderId: string): Promise<RefundRecord[]>;

  /**
   * Helper method to validate refund data
   * Can be used by platform implementations
   */
  protected validateRefundData(refundData: RefundData): void {
    if (!refundData.amount || refundData.amount <= 0) {
      throw new Error('Refund amount must be greater than 0');
    }
    if (!refundData.reason) {
      throw new Error('Refund reason is required');
    }
  }

  /**
   * Helper method to ensure service is initialized before operations
   * Can be used by platform implementations
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} is not initialized`);
    }
  }
}
