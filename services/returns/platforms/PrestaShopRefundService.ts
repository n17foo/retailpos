import { PlatformRefundServiceInterface, PlatformCredentials } from './PlatformRefundServiceInterface';
import { RefundData, RefundResult, RefundRecord } from '../ReturnService';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { SecretsServiceFactory } from '../../secrets/SecretsService';
import { SecretsServiceInterface } from '../../secrets/SecretsServiceInterface';
import { PrestaShopApiClient } from '../../clients/prestashop/PrestaShopApiClient';

/**
 * PrestaShop-specific implementation of the refund service
 * Handles refunds for PrestaShop orders
 */
export class PrestaShopRefundService implements PlatformRefundServiceInterface {
  private apiClient = PrestaShopApiClient.getInstance();
  private initialized: boolean = false;
  private refundHistory: Map<string, RefundRecord[]> = new Map();
  private logger = LoggerFactory.getInstance().createLogger('PrestaShopRefundService');
  private secretsService: SecretsServiceInterface;

  constructor() {
    this.secretsService = SecretsServiceFactory.getInstance().getService();
  }

  /**
   * Initialize the PrestaShop refund service
   */
  async initialize(): Promise<boolean> {
    try {
      const credentials = await this.getPrestaShopCredentials();
      this.initialized = credentials !== null;
      if (this.initialized) {
        this.logger.info('PrestaShop refund service initialized');
      } else {
        this.logger.warn('PrestaShop refund service initialization failed - missing credentials');
      }
      return this.initialized;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing PrestaShop refund service' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get PrestaShop API credentials from secrets service
   */
  private async getPrestaShopCredentials(): Promise<PlatformCredentials | null> {
    try {
      const credentials = await this.secretsService.getSecret('prestashop_api_credentials');
      if (!credentials) {
        this.logger.error({ message: 'PrestaShop API credentials not found in secrets store' });
        return null;
      }
      return JSON.parse(credentials);
    } catch (error) {
      this.logger.error({ message: 'Error retrieving PrestaShop credentials' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Process a refund for a PrestaShop order
   * PrestaShop handles refunds via order_slip (credit slip) creation
   * @param orderId The PrestaShop order ID to refund
   * @param refundData Details about the refund
   */
  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    try {
      if (!this.isInitialized()) {
        throw new Error('PrestaShop refund service not initialized');
      }

      // Build XML payload for PrestaShop Web Services
      const orderDetailLines =
        refundData.items
          ?.map(
            item =>
              `<order_detail><id_order_detail>${item.lineItemId}</id_order_detail><product_quantity>${item.quantity}</product_quantity><amount_tax_excl>${item.amount || 0}</amount_tax_excl><amount_tax_incl>${item.amount || 0}</amount_tax_incl></order_detail>`
          )
          .join('') || '';

      const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_slip>
    <id_order>${orderId}</id_order>
    <total_shipping_tax_incl>0</total_shipping_tax_incl>
    <total_shipping_tax_excl>0</total_shipping_tax_excl>
    <total_products_tax_incl>${refundData.amount || 0}</total_products_tax_incl>
    <total_products_tax_excl>${refundData.amount || 0}</total_products_tax_excl>
    <amount>${refundData.amount || 0}</amount>
    <associations><order_slip_details>${orderDetailLines}</order_slip_details></associations>
  </order_slip>
</prestashop>`;

      this.logger.info(`Processing PrestaShop refund for order ${orderId}`);

      const responseText = await this.apiClient.post<string>('order_slip', xmlPayload);
      const idMatch = typeof responseText === 'string' ? responseText.match(/<id>.*?(\d+).*?<\/id>/) : null;
      const refundId = idMatch ? idMatch[1] : `prestashop-refund-${Date.now()}`;

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
      this.logger.error({ message: 'Error processing PrestaShop refund' }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get refund history for a PrestaShop order
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
