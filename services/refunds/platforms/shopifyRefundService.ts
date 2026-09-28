import { PlatformCredentials } from './PlatformRefundServiceInterface';
import { BaseRefundService } from './BaseRefundService';
import { RefundData, RefundResult, RefundRecord } from '../RefundService';
import { getPlatformCredentials } from '../../config/PlatformCredentialsResolver';
import { ECommercePlatform } from '../../../utils/platforms';
import { ShopifyApiClient } from '../../clients/shopify/ShopifyApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * Shopify-specific implementation of the refund service
 * Handles refunds for Shopify orders
 */
export class ShopifyRefundService extends BaseRefundService {
  private refundHistory: Map<string, RefundRecord[]> = new Map();
  private apiClient = ShopifyApiClient.getInstance();

  constructor() {
    super();
    // Override the logger with a more specific name
    this.logger = LoggerFactory.getInstance().createLogger('ShopifyRefundService');
  }

  /**
   * Initialize the Shopify refund service
   */
  async initialize(): Promise<boolean> {
    try {
      // Initialize directly without depending on the e-commerce factory
      // Check for credentials availability
      const credentials = await this.getShopifyCredentials();
      this.initialized = credentials !== null;

      if (this.initialized) {
        this.logger.info('Shopify refund service initialized successfully');
      } else {
        this.logger.warn('Shopify refund service initialization failed - missing credentials');
      }

      return this.initialized;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing Shopify refund service' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get Shopify API credentials from secrets service
   * @returns Shopify API credentials or null if not found
   */
  private async getShopifyCredentials(): Promise<PlatformCredentials | null> {
    try {
      const credentials = await getPlatformCredentials(ECommercePlatform.SHOPIFY);
      if (!credentials) {
        this.logger.error({ message: 'Shopify API credentials not configured' });
        return null;
      }

      return credentials;
    } catch (error) {
      this.logger.error({ message: 'Error retrieving Shopify credentials' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Process a Shopify refund directly using the API
   * @param orderId Order ID to refund
   * @param refundData Refund details
   */
  private async processShopifyRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      this.logger.info(`Processing Shopify refund for order ${orderId}`);

      const data = await this.apiClient.post<{ refund?: { id?: number | string } }>(`orders/${orderId}/refunds.json`, {
        refund: {
          notify: true,
          note: refundData.reason || 'Refunded via RetailPOS',
          shipping: { full_refund: false },
          refund_line_items:
            refundData.items?.map(item => ({
              line_item_id: item.lineItemId,
              quantity: item.quantity,
              amount: item.amount,
            })) || [],
          transactions: [{ amount: refundData.amount, kind: 'refund', gateway: 'manual' }],
        },
      });
      const refundId = String(data.refund?.id || `shopify-refund-${Date.now()}`);

      return {
        success: true,
        refundId,
        amount: refundData.amount || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        { message: `Error processing Shopify refund for order ${orderId}` },
        error instanceof Error ? error : new Error(String(error))
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Process a refund for a Shopify order
   * @param orderId The Shopify order ID to refund
   * @param refundData Details about the refund
   */
  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      this.ensureInitialized();
      this.validateRefundData(refundData);

      this.logger.info(`Processing Shopify refund for order: ${orderId}`);

      // Process refund directly with Shopify API
      const result = await this.processShopifyRefund(orderId, refundData);

      // If successful, record the refund in history
      if (result.success && result.refundId) {
        const refundRecord: RefundRecord = {
          id: result.refundId,
          orderId,
          amount: result.amount || refundData.amount || 0,
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
      }

      return {
        ...result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error({ message: 'Error processing Shopify refund' }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get refund history for a Shopify order
   * @param orderId The order ID to get refund history for
   */
  async getRefundHistory(orderId: string): Promise<RefundRecord[]> {
    return this.refundHistory.get(orderId) || [];
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
