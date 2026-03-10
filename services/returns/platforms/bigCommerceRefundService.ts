import { PlatformRefundServiceInterface, PlatformCredentials } from './PlatformRefundServiceInterface';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { ECommercePlatform } from '../../../utils/platforms';
import { SecretsServiceFactory } from '../../secrets/SecretsService';
import { SecretsServiceInterface } from '../../secrets/SecretsServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../ReturnService';
import { withTokenRefresh } from '../../token/TokenUtils';
import { BigCommerceApiClient } from '../../clients/bigcommerce/BigCommerceApiClient';

/**
 * BigCommerce-specific implementation of the refund service
 * Handles refunds for BigCommerce orders
 */
export class BigCommerceRefundService implements PlatformRefundServiceInterface {
  private apiClient = BigCommerceApiClient.getInstance();
  private initialized: boolean = false;
  private refundHistory: Map<string, RefundRecord[]> = new Map();
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;
  private secretsService: SecretsServiceInterface;

  constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('BigCommerceRefundService');
    this.secretsService = SecretsServiceFactory.getInstance().getService();
  }

  /**
   * Initialize the BigCommerce refund service
   */
  async initialize(): Promise<boolean> {
    try {
      // Initialize directly without depending on the e-commerce factory
      // Check for credentials availability
      const credentials = await this.getBigCommerceCredentials();

      if (credentials) {
        if (!this.apiClient.isInitialized()) {
          await this.apiClient.initialize();
        }

        this.initialized = true;
        this.logger.info('BigCommerce refund service initialized successfully');
      } else {
        this.logger.warn('BigCommerce refund service initialization failed - missing credentials');
        this.initialized = false;
      }

      return this.initialized;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing BigCommerce refund service' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get BigCommerce API credentials from secrets service
   * @returns BigCommerce API credentials or null if not found
   */
  private async getBigCommerceCredentials(): Promise<PlatformCredentials | null> {
    try {
      const credentials = await this.secretsService.getSecret('bigcommerce_api_credentials');
      if (!credentials) {
        this.logger.error({ message: 'BigCommerce API credentials not found in secrets store' });
        return null;
      }

      return JSON.parse(credentials);
    } catch (error) {
      this.logger.error({ message: 'Error retrieving BigCommerce credentials' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Process a BigCommerce refund directly using the API
   * @param orderId Order ID to refund
   * @param refundData Refund details
   */
  private async processBigCommerceRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      const credentials = await this.getBigCommerceCredentials();
      if (!credentials) {
        throw new Error('Failed to retrieve BigCommerce API credentials');
      }

      const headers = this.apiClient['buildHeaders']();

      const endpoint = `${credentials.apiUrl}/stores/${credentials.storeHash || ''}/v3/orders/${orderId}/payment_actions/refunds`;

      const requestData = {
        items:
          refundData.items?.map(item => ({
            item_type: 'PRODUCT',
            item_id: Number(item.lineItemId),
            quantity: item.quantity,
            amount: item.amount,
          })) || [],
        reason: refundData.reason || 'Refunded via RetailPOS',
        payments: [
          {
            provider_id: 'custom',
            amount: refundData.amount || 0,
            offline: true,
          },
        ],
      };

      this.logger.info(`Processing BigCommerce refund for order ${orderId} at ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          Accept: 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`BigCommerce refund API returned ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const refundId = String(data.data?.id || `bigcommerce-refund-${Date.now()}`);

      return {
        success: true,
        refundId,
        amount: refundData.amount || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        { message: `Error processing BigCommerce refund for order ${orderId}` },
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
   * Process a refund for a BigCommerce order
   * @param orderId The BigCommerce order ID to refund
   * @param refundData Details about the refund
   */
  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce refund service not initialized');
    }

    this.logger.info(`Processing BigCommerce refund for order: ${orderId}`);

    return withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
      try {
        // Process refund directly with BigCommerce API
        const result = await this.processBigCommerceRefund(orderId, refundData);

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
            timestamp: result.timestamp || new Date(),
          };

          // Record refund in history for the order
          this.recordRefund(orderId, refundRecord);
        }

        return result;
      } catch (error) {
        this.logger.error(
          { message: `Error processing refund for order ${orderId}` },
          error instanceof Error ? error : new Error(String(error))
        );

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        };
      }
    });
  }

  /**
   * Record a refund in the history for an order
   */
  private recordRefund(orderId: string, refundRecord: RefundRecord): void {
    // Get the existing refunds for this order, or create an empty array if none
    const orderRefunds = this.refundHistory.get(orderId) || [];

    // Add new refund to history
    orderRefunds.push(refundRecord);

    // Update the map
    this.refundHistory.set(orderId, orderRefunds);

    this.logger.info(`Recorded refund ${refundRecord.id} for order ${orderId}`);
  }

  /**
   * Get refund history for an order
   * @param orderId The order ID to get refund history for
   * @returns Promise resolving to list of refunds for the order
   */
  async getRefundHistory(orderId: string): Promise<RefundRecord[]> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce refund service not initialized');
    }

    // Return the refund history for this order or empty array if none
    return this.refundHistory.get(orderId) || [];
  }
}
