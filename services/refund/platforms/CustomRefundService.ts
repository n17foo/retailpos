import { PlatformRefundServiceInterface } from './platformRefundServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../refundServiceInterface';
import { LoggerFactory } from '../../logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REFUNDS_STORAGE_KEY = 'custom_local_refunds';

/**
 * Custom/Local refund service for offline-first POS operation
 * All refunds are stored locally only - no online sync
 * This is a simplified mock implementation for local-only mode
 */
export class CustomRefundService implements PlatformRefundServiceInterface {
  private initialized: boolean = false;
  private refundHistory: Map<string, RefundRecord[]> = new Map();
  private logger = LoggerFactory.getInstance().createLogger('CustomRefundService');

  /**
   * Initialize the custom refund service
   * Loads refund history from local storage
   */
  async initialize(): Promise<boolean> {
    try {
      const storedRefunds = await AsyncStorage.getItem(REFUNDS_STORAGE_KEY);
      if (storedRefunds) {
        const parsed = JSON.parse(storedRefunds);
        this.refundHistory = new Map(Object.entries(parsed));
        this.logger.info('Loaded refund history from local storage');
      }

      this.initialized = true;
      this.logger.info('Custom refund service initialized (local-only mode)');
      return true;
    } catch (error) {
      this.logger.error({ message: 'Error initializing custom refund service' }, error instanceof Error ? error : new Error(String(error)));
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Process a refund for a local order
   * In custom/local mode, this just records the refund locally
   */
  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      this.logger.info(`Processing local refund for order: ${orderId}`);

      // Generate refund ID
      const refundId = `local-refund-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create refund record
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
        source: 'ecommerce', // Local refund recorded as ecommerce type
        timestamp: new Date(),
      };

      // Add to history
      this.addRefundToHistory(orderId, refundRecord);
      await this.saveToStorage();

      this.logger.info(`Local refund processed: ${refundId}`);

      return {
        success: true,
        refundId,
        amount: refundData.amount || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        { message: `Error processing local refund for order ${orderId}` },
        error instanceof Error ? error : new Error(String(error))
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get refund history for an order
   */
  async getRefundHistory(orderId: string): Promise<RefundRecord[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.refundHistory.get(orderId) || [];
  }

  /**
   * Get all refunds
   */
  async getAllRefunds(): Promise<RefundRecord[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const allRefunds: RefundRecord[] = [];
    this.refundHistory.forEach(records => {
      allRefunds.push(...records);
    });

    return allRefunds.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Add a refund record to history
   */
  private addRefundToHistory(orderId: string, refund: RefundRecord): void {
    const history = this.refundHistory.get(orderId) || [];
    history.push(refund);
    this.refundHistory.set(orderId, history);
  }

  /**
   * Save refund history to local storage
   */
  private async saveToStorage(): Promise<void> {
    const obj = Object.fromEntries(this.refundHistory);
    await AsyncStorage.setItem(REFUNDS_STORAGE_KEY, JSON.stringify(obj));
  }

  /**
   * Clear all local refunds
   */
  async clearLocalRefunds(): Promise<void> {
    this.refundHistory.clear();
    await AsyncStorage.removeItem(REFUNDS_STORAGE_KEY);
    this.logger.info('Cleared all local refunds');
  }
}

export const customRefundService = new CustomRefundService();
