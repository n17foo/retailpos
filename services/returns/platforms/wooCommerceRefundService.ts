import { PlatformRefundServiceInterface, PlatformCredentials } from './PlatformRefundServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../ReturnService';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { SecretsServiceFactory } from '../../secrets/SecretsService';
import { SecretsServiceInterface } from '../../secrets/SecretsServiceInterface';
import { WOOCOMMERCE_API_VERSION } from '../../config/apiVersions';
import { WooCommerceApiClient } from '../../clients/woocommerce/WooCommerceApiClient';

/**
 * WooCommerce-specific implementation of the refund service
 * Handles refunds for WooCommerce orders
 */
export class WooCommerceRefundService implements PlatformRefundServiceInterface {
  private apiClient = WooCommerceApiClient.getInstance();
  private initialized: boolean = false;
  private refundHistory: Map<string, RefundRecord[]> = new Map();
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;
  private secretsService: SecretsServiceInterface;

  constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('WooCommerceRefundService');
    this.secretsService = SecretsServiceFactory.getInstance().getService();
  }

  /**
   * Initialize the WooCommerce refund service
   */
  async initialize(): Promise<boolean> {
    try {
      // Initialize directly without depending on the e-commerce factory
      // Check for credentials availability
      const credentials = await this.getWooCommerceCredentials();
      this.initialized = credentials !== null;

      if (this.initialized) {
        this.logger.info('WooCommerce refund service initialized successfully');
      } else {
        this.logger.warn('WooCommerce refund service initialization failed - missing credentials');
      }

      return this.initialized;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing WooCommerce refund service' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get WooCommerce API credentials from secrets service
   * @returns WooCommerce API credentials or null if not found
   */
  private async getWooCommerceCredentials(): Promise<PlatformCredentials | null> {
    try {
      const credentials = await this.secretsService.getSecret('woocommerce_api_credentials');
      if (!credentials) {
        this.logger.error({ message: 'WooCommerce API credentials not found in secrets store' });
        return null;
      }

      return JSON.parse(credentials);
    } catch (error) {
      this.logger.error({ message: 'Error retrieving WooCommerce credentials' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Process a WooCommerce refund directly using the API
   * @param orderId Order ID to refund
   * @param refundData Refund details
   */
  private async processWooCommerceRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      const credentials = await this.getWooCommerceCredentials();
      if (!credentials) {
        throw new Error('Failed to retrieve WooCommerce API credentials');
      }

      const endpoint = `${credentials.apiUrl}/wp-json/${WOOCOMMERCE_API_VERSION}/orders/${orderId}/refunds`;

      const requestData = {
        api_refund: true,
        amount: String(refundData.amount || 0),
        reason: refundData.reason || 'Refunded via RetailPOS',
        line_items:
          refundData.items?.map(item => ({
            id: item.lineItemId,
            quantity: item.quantity,
            refund_total: String(item.amount || 0),
          })) || [],
      };

      this.logger.info(`Processing WooCommerce refund for order ${orderId} at ${endpoint}`);

      const headers = this.apiClient['buildHeaders']();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`WooCommerce refund API returned ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const refundId = String(data.id || `wc-refund-${Date.now()}`);

      return {
        success: true,
        refundId,
        amount: refundData.amount || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        { message: `Error processing WooCommerce refund for order ${orderId}` },
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
   * Process a refund for a WooCommerce order
   * @param orderId The WooCommerce order ID to refund
   * @param refundData Details about the refund
   */
  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      if (!this.isInitialized()) {
        throw new Error('WooCommerce refund service not initialized');
      }

      this.logger.info(`Processing WooCommerce refund for order: ${orderId}`);

      // Process refund directly with WooCommerce API
      const result = await this.processWooCommerceRefund(orderId, refundData);

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
      this.logger.error({ message: 'Error processing WooCommerce refund' }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get refund history for a WooCommerce order
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
