import { PlatformRefundServiceInterface } from './platformRefundServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../refundServiceInterface';
import { LoggerFactory } from '../../logger';
import { ECommercePlatform } from '../../../utils/platforms';
import { SecretsServiceFactory } from '../../secrets/secretsService';
import { SecretsServiceInterface } from '../../secrets/SecretsServiceInterface';
import { getPlatformToken } from '../../token/tokenUtils';
import { TokenType } from '../../token/tokenServiceInterface';

/**
 * Sylius-specific implementation of the refund service
 * Handles refunds for Sylius orders
 */
export class SyliusRefundService implements PlatformRefundServiceInterface {
  private initialized: boolean = false;
  private refundHistory: Map<string, RefundRecord[]> = new Map();
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;
  private secretsService: SecretsServiceInterface;

  constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('SyliusRefundService');
    this.secretsService = SecretsServiceFactory.getInstance().getService();
  }

  /**
   * Initialize the Sylius refund service
   */
  async initialize(): Promise<boolean> {
    try {
      // Initialize directly without depending on the e-commerce factory
      // Check for credentials availability
      const credentials = await this.getSyliusCredentials();
      this.initialized = credentials !== null;

      if (this.initialized) {
        this.logger.info('Sylius refund service initialized successfully');
      } else {
        this.logger.warn('Sylius refund service initialization failed - missing credentials');
      }

      return this.initialized;
    } catch (error) {
      this.logger.error({ message: 'Error initializing Sylius refund service' }, error instanceof Error ? error : new Error(String(error)));
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get Sylius API credentials from secrets service
   * @returns Sylius API credentials or null if not found
   */
  private async getSyliusCredentials(): Promise<any> {
    try {
      const credentials = await this.secretsService.getSecret('sylius_api_credentials');
      if (!credentials) {
        this.logger.error({ message: 'Sylius API credentials not found in secrets store' });
        return null;
      }

      return JSON.parse(credentials);
    } catch (error) {
      this.logger.error({ message: 'Error retrieving Sylius credentials' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Create a Sylius HTTP client
   * @param credentials Sylius API credentials
   * @returns HTTP client object
   */
  private async createSyliusApiClient(credentials: any): Promise<any> {
    // Get the access token from the token management system
    const accessToken = await getPlatformToken(ECommercePlatform.SYLIUS, TokenType.ACCESS);

    if (!accessToken) {
      this.logger.error('Failed to get Sylius access token');
      throw new Error('Failed to get Sylius access token');
    }
    return {
      post: async (endpoint: string, data: any) => {
        this.logger.info(`Making API call to Sylius ${endpoint}`);

        // In a real implementation, this would make an authenticated API call
        // const response = await fetch(`${credentials.apiUrl}${endpoint}`, {
        //   method: 'POST',
        //   headers: {
        //     'Authorization': `Bearer ${accessToken}`,
        //     'Content-Type': 'application/json'
        //   },
        //   body: JSON.stringify(data)
        // });

        // For now, simulate a successful response
        return {
          data: {
            id: `sylius-refund-${Date.now()}`,
            order_number: data.orderNumber,
            status: 'completed',
          },
        };
      },
    };
  }

  /**
   * Process a Sylius refund directly using the API
   * @param orderId Order ID to refund
   * @param refundData Refund details
   */
  private async processSyliusRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      const credentials = await this.getSyliusCredentials();

      if (!credentials) {
        throw new Error('Failed to retrieve Sylius API credentials');
      }

      // Create API client
      const apiClient = await this.createSyliusApiClient(credentials);

      // Format the request data
      const requestData = {
        orderNumber: orderId,
        paymentMethod: 'manual',
        amount: refundData.amount || 0,
        reason: refundData.reason || 'Refunded via RetailPOS',
        items:
          refundData.items?.map(item => ({
            orderItemId: item.lineItemId,
            quantity: item.quantity,
            amount: item.amount,
          })) || [],
      };

      // Make API call
      const response = await apiClient.post('/api/v1/orders/refunds', requestData);

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
        { message: `Error processing Sylius refund for order ${orderId}` },
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
   * Process a refund for a Sylius order
   * @param orderId The Sylius order ID to refund
   * @param refundData Details about the refund
   */
  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      if (!this.isInitialized()) {
        throw new Error('Sylius refund service not initialized');
      }

      this.logger.info(`Processing Sylius refund for order: ${orderId}`);

      // Process refund directly with Sylius API
      const result = await this.processSyliusRefund(orderId, refundData);

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
      this.logger.error({ message: 'Error processing Sylius refund' }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get refund history for a Sylius order
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
