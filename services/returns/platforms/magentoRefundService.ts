import { PlatformRefundServiceInterface, PlatformCredentials } from './PlatformRefundServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../ReturnService';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { SecretsServiceFactory } from '../../secrets/SecretsService';
import { SecretsServiceInterface } from '../../secrets/SecretsServiceInterface';
import { MAGENTO_API_VERSION } from '../../config/apiVersions';
import { MagentoApiClient } from '../../clients/magento/MagentoApiClient';

/**
 * Magento-specific implementation of the refund service
 * Handles refunds for Magento orders
 */
export class MagentoRefundService implements PlatformRefundServiceInterface {
  private apiClient = MagentoApiClient.getInstance();
  private initialized: boolean = false;
  private refundHistory: Map<string, RefundRecord[]> = new Map();
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;
  private secretsService: SecretsServiceInterface;

  constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('MagentoRefundService');
    this.secretsService = SecretsServiceFactory.getInstance().getService();
  }

  /**
   * Initialize the Magento refund service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set initialization flag directly - we'll handle dependencies separately
      this.initialized = true;
      this.logger.info('Magento refund service initialized');
      return this.initialized;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing Magento refund service' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Retrieve Magento API credentials from the secure store
   * @returns Credentials object containing API key and other required authentication details
   */
  private async getMagentoCredentials(): Promise<PlatformCredentials | null> {
    try {
      // Get credentials from secrets service - keep for compatibility with endpoint URLs
      const credentials = await this.secretsService.getSecret('magento_api_credentials');
      if (!credentials) {
        this.logger.error({ message: 'Magento API credentials not found in secrets store' });
        return null;
      }

      return JSON.parse(credentials);
    } catch (error) {
      this.logger.error({ message: 'Error retrieving Magento credentials' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Process a refund directly with the Magento API
   * @param orderId The order ID to refund
   * @param refundData The refund data
   * @returns The refund result
   */
  private async processMagentoRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      const credentials = await this.getMagentoCredentials();
      if (!credentials) {
        throw new Error('Failed to retrieve Magento API credentials');
      }

      const headers = this.apiClient['buildHeaders']();

      const endpoint = `${credentials.apiUrl}/rest/${MAGENTO_API_VERSION}/order/${orderId}/refund`;

      const requestData = {
        items:
          refundData.items?.map(item => ({
            order_item_id: item.lineItemId,
            qty: item.quantity,
          })) || [],
        notify: true,
        arguments: {
          adjustment_positive: 0,
          adjustment_negative: 0,
          shipping_amount: 0,
          extension_attributes: {},
        },
        comment: {
          comment: refundData.note || refundData.reason || 'Refund processed via RetailPOS',
          is_visible_on_front: 1,
        },
      };

      this.logger.info(`Processing Magento refund for order ${orderId} at ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Magento refund API returned ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      // Magento returns the credit memo ID directly
      const refundId = String(data || `magento-refund-${Date.now()}`);

      return {
        success: true,
        refundId,
        amount: refundData.amount || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        { message: `Error processing Magento refund for order ${orderId}` },
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
   * Process a refund for a Magento order
   * @param orderId The Magento order ID to refund
   * @param refundData Details about the refund
   */
  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      if (!this.isInitialized()) {
        throw new Error('Magento refund service not initialized');
      }

      this.logger.info(`Processing Magento refund for order: ${orderId}`);

      // Process refund directly with Magento API
      // Instead of using the ECommerceServiceFactory, we'll implement direct API calls
      const result = await this.processMagentoRefund(orderId, refundData);

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
      this.logger.error({ message: 'Error processing Magento refund' }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get refund history for a Magento order
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
