import { PlatformRefundServiceInterface, PlatformCredentials } from './PlatformRefundServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../ReturnService';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { SecretsServiceFactory } from '../../secrets/SecretsService';
import { SecretsServiceInterface } from '../../secrets/SecretsServiceInterface';
import { SQUARESPACE_API_VERSION } from '../../config/apiVersions';
import { SquarespaceApiClient } from '../../clients/squarespace/SquarespaceApiClient';

/**
 * Squarespace-specific implementation of the refund service
 * Handles refunds for Squarespace orders
 */
export class SquarespaceRefundService implements PlatformRefundServiceInterface {
  private apiClient = SquarespaceApiClient.getInstance();
  private initialized: boolean = false;
  private refundHistory: Map<string, RefundRecord[]> = new Map();
  private logger = LoggerFactory.getInstance().createLogger('SquarespaceRefundService');
  private secretsService: SecretsServiceInterface;

  constructor() {
    this.secretsService = SecretsServiceFactory.getInstance().getService();
  }

  /**
   * Initialize the Squarespace refund service
   */
  async initialize(): Promise<boolean> {
    try {
      const credentials = await this.getSquarespaceCredentials();
      this.initialized = credentials !== null;
      if (this.initialized) {
        this.logger.info('Squarespace refund service initialized');
      } else {
        this.logger.warn('Squarespace refund service initialization failed - missing credentials');
      }
      return this.initialized;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing Squarespace refund service' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get Squarespace API credentials from secrets service
   */
  private async getSquarespaceCredentials(): Promise<PlatformCredentials | null> {
    try {
      const credentials = await this.secretsService.getSecret('squarespace_api_credentials');
      if (!credentials) {
        this.logger.error({ message: 'Squarespace API credentials not found in secrets store' });
        return null;
      }
      return JSON.parse(credentials);
    } catch (error) {
      this.logger.error({ message: 'Error retrieving Squarespace credentials' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Process a refund for a Squarespace order
   * Squarespace Commerce API: POST /commerce/orders/{orderId}/refunds
   * @param orderId The Squarespace order ID to refund
   * @param refundData Details about the refund
   */
  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      if (!this.isInitialized()) {
        throw new Error('Squarespace refund service not initialized');
      }

      const credentials = await this.getSquarespaceCredentials();
      if (!credentials) {
        throw new Error('Failed to retrieve Squarespace API credentials');
      }

      const endpoint = `https://api.squarespace.com/${SQUARESPACE_API_VERSION}/commerce/orders/${orderId}/refunds`;

      const requestData = {
        amount: String(refundData.amount || 0),
        reason: refundData.reason || 'Refunded via RetailPOS',
        lineItems:
          refundData.items?.map(item => ({
            lineItemId: item.lineItemId,
            quantity: item.quantity,
          })) || [],
      };

      this.logger.info(`Processing Squarespace refund for order ${orderId} at ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...this.apiClient['buildHeaders'](),
          'User-Agent': 'RetailPOS/1.0',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Squarespace refund API returned ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const refundId = String(data.id || `squarespace-refund-${Date.now()}`);

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
      this.logger.error({ message: 'Error processing Squarespace refund' }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get refund history for a Squarespace order
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
