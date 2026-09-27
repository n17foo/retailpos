/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { RefundData, RefundResult, RefundRecord } from '../RefundService';
import { PlatformRefundServiceInterface } from './PlatformRefundServiceInterface';
import { CommercefullApiClient, CommercefullConfig } from '../../clients/commercefull/CommercefullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { toCents, toDollars } from '../../../utils/money';

/**
 * Commercefull platform implementation of the refund service.
 *
 * Endpoint mapping:
 *   POST /business/orders/:orderId/refund   → processRefund
 *        body: { amount: integer cents, reason, transactionId? }
 *        response: { refundAmountCents, newPaymentStatus, orderStatus, processedAt }
 *   GET  /business/orders/:orderId/refunds → getRefundHistory
 *        response: { orderId, refunds: [{ refundId, amountCents, reason, status, ... }] }
 */
export class CommercefullRefundService implements PlatformRefundServiceInterface {
  private initialized = false;
  private config: Record<string, any> = {};
  private apiClient: CommercefullApiClient;
  private logger = LoggerFactory.getInstance().createLogger('CommercefullRefundService');

  constructor(config: Record<string, any> = {}) {
    this.config = config;
    this.apiClient = CommercefullApiClient.getInstance();
  }

  async initialize(): Promise<boolean> {
    try {
      const clientConfig: CommercefullConfig = {
        storeUrl: this.config.storeUrl,
        apiKey: this.config.apiKey,
        apiSecret: this.config.apiSecret,
        apiVersion: this.config.apiVersion,
      };

      this.apiClient.configure(clientConfig);
      const ok = await this.apiClient.initialize();
      if (ok) this.initialized = true;
      return ok;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Commercefull refund service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async processRefund(orderId: string, refundData: RefundData): Promise<RefundResult> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull refund service not initialized');
    }

    try {
      // The platform expects the refund amount in integer cents and
      // requires a reason; item-level refunds are not supported.
      const data = await this.apiClient.post<any>(`/business/orders/${orderId}/refund`, {
        amount: toCents(refundData.amount ?? 0),
        reason: refundData.reason || refundData.note || 'POS refund',
      });

      const result = data.data || data;
      return {
        success: true,
        refundId: result.refundId || `${orderId}-refund`,
        amount: result.refundAmountCents != null ? toDollars(result.refundAmountCents) : refundData.amount,
        timestamp: result.processedAt ? new Date(result.processedAt) : new Date(),
      };
    } catch (error) {
      this.logger.error(
        { message: `Error processing refund for order ${orderId}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        success: false,
        refundId: '',
        amount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getRefundHistory(orderId: string): Promise<RefundRecord[]> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull refund service not initialized');
    }

    try {
      // Refunds are listed via the dedicated endpoint, not embedded on the order.
      const data = await this.apiClient.get<any>(`/business/orders/${orderId}/refunds`);
      const payload = data.data || data;
      const refunds = payload.refunds || payload || [];

      return (Array.isArray(refunds) ? refunds : []).map((r: any) => ({
        id: String(r.refundId || r.id || ''),
        orderId,
        transactionId: r.transactionId ? String(r.transactionId) : undefined,
        amount: toDollars(r.amountCents) || 0,
        reason: r.reason || '',
        status: r.status === 'pending' || r.status === 'failed' ? r.status : 'completed',
        source: 'ecommerce' as const,
        timestamp: r.createdAt ? new Date(r.createdAt) : new Date(),
      }));
    } catch (error) {
      this.logger.error(
        { message: `Error fetching refund history for order ${orderId}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }
}
