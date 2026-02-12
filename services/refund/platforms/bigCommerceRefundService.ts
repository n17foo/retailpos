import { PlatformRefundServiceInterface } from './platformRefundServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../refundServiceInterface';
import { LoggerFactory } from '../../logger/loggerFactory';
import { ECommercePlatform } from '../../../utils/platforms';
import { SecretsServiceFactory } from '../../secrets/secretsService';
import { SecretsServiceInterface } from '../../secrets/SecretsServiceInterface';
import { getPlatformToken, withTokenRefresh } from '../../token/tokenUtils';
import { TokenType } from '../../token/tokenServiceInterface';
import { TokenInitializer } from '../../token/tokenInitializer';

/**
 * BigCommerce-specific implementation of the refund service
 * Handles refunds for BigCommerce orders
 */
export class BigCommerceRefundService implements PlatformRefundServiceInterface {
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
        // Initialize the token provider for BigCommerce
        const tokenInitialized = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.BIGCOMMERCE);

        if (!tokenInitialized) {
          this.logger.warn('Failed to initialize BigCommerce token provider');
          return false;
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
  private async getBigCommerceCredentials(): Promise<any> {
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
   * Create an HTTP client for BigCommerce API
   * @param credentials BigCommerce API credentials
   * @returns HTTP client object
   */
  private async createBigCommerceApiClient(credentials: any): Promise<any> {
    // Get the access token from the token management system
    const accessToken = await getPlatformToken(ECommercePlatform.BIGCOMMERCE, TokenType.ACCESS);

    if (!accessToken) {
      this.logger.error('Failed to get BigCommerce access token');
      throw new Error('Failed to get BigCommerce access token');
    }

    return {
      post: async (endpoint: string, data: any) => {
        this.logger.info(`Making API call to BigCommerce ${endpoint}`);

        // In a real implementation, this would make an authenticated API call
        // const response = await fetch(`${credentials.apiUrl}${endpoint}`, {
        //   method: 'POST',
        //   headers: {
        //     'X-Auth-Token': accessToken,
        //     'Content-Type': 'application/json'
        //   },
        //   body: JSON.stringify(data)
        // });

        // For now, simulate a successful response
        return {
          data: {
            id: `bigcommerce-refund-${Date.now()}`,
            orderId: data.orderId,
            status: 'COMPLETED',
          },
        };
      },
    };
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

      // Create API client
      const apiClient = await this.createBigCommerceApiClient(credentials);

      // Format the request data
      const requestData = {
        items: refundData.items?.map(item => ({
          item_id: item.lineItemId,
          quantity: item.quantity,
          amount: item.amount,
        })),
        reason: refundData.reason || 'Refunded via RetailPOS',
        amount: refundData.amount,
      };

      // Make API call
      const response = await apiClient.post(`/orders/${orderId}/refunds`, requestData);

      // Process response
      const refundId = response.data.id;

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
