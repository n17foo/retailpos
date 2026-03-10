/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { GiftCardServiceInterface, GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { CommerceFullApiClient, CommerceFullConfig } from '../../clients/commercefull/CommerceFullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * CommerceFull platform implementation of the gift card service.
 *
 * Endpoint mapping (promotion customer router):
 *   GET  /customer/gift-cards/balance/:code  → checkBalance
 *   POST /customer/gift-cards/redeem         → redeemGiftCard
 */
export class CommerceFullGiftCardService implements GiftCardServiceInterface {
  private initialized = false;
  private config: Record<string, any>;
  private apiClient: CommerceFullApiClient;
  private logger = LoggerFactory.getInstance().createLogger('CommerceFullGiftCardService');

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
        { message: 'Failed to initialize CommerceFull gift card service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull gift card service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>(`/customer/gift-cards/balance/${encodeURIComponent(code)}`);
      const gc = data.data || data.giftCard || data;

      return {
        code: gc.code || code,
        balance: parseFloat(gc.balance || gc.remainingBalance) || 0,
        currency: gc.currency || 'USD',
        status: this.mapStatus(gc.status),
        expiresAt: gc.expiresAt ? new Date(gc.expiresAt) : undefined,
        lastUsedAt: gc.lastUsedAt ? new Date(gc.lastUsedAt) : undefined,
      };
    } catch (error) {
      this.logger.error(
        { message: `Error checking gift card balance for ${code}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        code,
        balance: 0,
        currency: 'USD',
        status: 'not_found',
      };
    }
  }

  async redeemGiftCard(code: string, amount: number): Promise<GiftCardRedemptionResult> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull gift card service not initialized');
    }

    try {
      const data = await this.apiClient.post<any>('/customer/gift-cards/redeem', {
        code,
        amount,
      });

      const result = data.data || data;
      return {
        success: result.success ?? true,
        amountDeducted: result.amountDeducted ?? amount,
        remainingBalance: parseFloat(result.remainingBalance || result.balance) || 0,
        transactionId: result.transactionId || result.id,
        error: result.error,
      };
    } catch (error) {
      this.logger.error({ message: `Error redeeming gift card ${code}` }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        amountDeducted: 0,
        remainingBalance: 0,
        error: error instanceof Error ? error.message : 'Failed to redeem gift card',
      };
    }
  }

  private mapStatus(status: string): 'active' | 'disabled' | 'expired' | 'not_found' {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'active';
      case 'disabled':
      case 'inactive':
      case 'cancelled':
        return 'disabled';
      case 'expired':
        return 'expired';
      default:
        return 'not_found';
    }
  }
}
