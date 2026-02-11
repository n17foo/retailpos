import { PlatformRefundServiceInterface } from './platformRefundServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../refundServiceInterface';
import { LoggerFactory } from '../../logger';
import { sqliteStorage } from '../../storage/SQLiteStorageService';

const REFUNDS_STORAGE_KEY = 'offline_local_refunds';

/**
 * Offline refund service for local-first POS operation
 * All refunds are stored locally via SQLite - no online sync
 */
export class OfflineRefundService implements PlatformRefundServiceInterface {
  private initialized: boolean = false;
  private refundHistory: Map<string, RefundRecord[]> = new Map();
  private logger = LoggerFactory.getInstance().createLogger('OfflineRefundService');

  /**
   * Initialize the offline refund service
   * Loads refund history from local storage
   */
  async initialize(): Promise<boolean> {
    try {
      const storedRefunds = await sqliteStorage.getItem(REFUNDS_STORAGE_KEY);
      if (storedRefunds) {
        const parsed = JSON.parse(storedRefunds);
        this.refundHistory = new Map(Object.entries(parsed));
        this.logger.info('Loaded refund history from local storage');
      }

      this.initialized = true;
      this.logger.info('Offline refund service initialized (local-only mode)');
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing offline refund service' },
        error instanceof Error ? error : new Error(String(error))
      );
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
   * In offline mode, this just records the refund locally
   */
  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      this.logger.info(`Processing local refund for order: ${orderId}`);

      const refundId = `local-refund-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    await sqliteStorage.setItem(REFUNDS_STORAGE_KEY, JSON.stringify(obj));
  }

  /**
   * Clear all local refunds
   */
  async clearLocalRefunds(): Promise<void> {
    this.refundHistory.clear();
    await sqliteStorage.removeItem(REFUNDS_STORAGE_KEY);
    this.logger.info('Cleared all local refunds');
  }
}

export const offlineRefundService = new OfflineRefundService();
