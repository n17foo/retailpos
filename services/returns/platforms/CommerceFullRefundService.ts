/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { RefundData, RefundResult, RefundRecord } from '../ReturnService';
import { PlatformRefundServiceInterface } from './PlatformRefundServiceInterface';
import { CommerceFullApiClient, CommerceFullConfig } from '../../clients/commercefull/CommerceFullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * CommerceFull platform implementation of the refund service.
 *
 * Endpoint mapping:
 *   POST /business/orders/:orderId/refund             → processRefund
 *   GET  /business/transactions/:transactionId/refunds → getRefundHistory
 */
export class CommerceFullRefundService implements PlatformRefundServiceInterface {
  private initialized = false;
  private config: Record<string, any> = {};
  private apiClient: CommerceFullApiClient;
  private logger = LoggerFactory.getInstance().createLogger('CommerceFullRefundService');

  constructor(config: Record<string, any> = {}) {
    this.config = config;
    this.apiClient = CommerceFullApiClient.getInstance();
  }

  async initialize(): Promise<boolean> {
    try {
      const clientConfig: CommerceFullConfig = {
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
        { message: 'Failed to initialize CommerceFull refund service' },
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
      throw new Error('CommerceFull refund service not initialized');
    }

    try {
      const data = await this.apiClient.post<any>(`/business/orders/${orderId}/refund`, {
        amount: refundData.amount,
        reason: refundData.reason,
        items: refundData.items,
        note: refundData.note,
      });

      const result = data.data || data;
      return {
        success: result.success ?? true,
        refundId: result.refundId || result.id || '',
        amount: result.amount ?? refundData.amount,
        timestamp: result.createdAt ? new Date(result.createdAt) : new Date(),
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
      throw new Error('CommerceFull refund service not initialized');
    }

    try {
      // Use the order endpoint to get refund info — refunds are tied to the order
      const data = await this.apiClient.get<any>(`/business/orders/${orderId}`);
      const order = data.data || data.order || data;
      const refunds = order.refunds || [];

      return refunds.map((r: any) => ({
        id: String(r.refundId || r.id || ''),
        orderId,
        amount: parseFloat(r.amount) || 0,
        reason: r.reason || '',
        status: r.status || 'completed',
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
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
