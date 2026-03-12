import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { BigCommerceApiClient } from '../../clients/bigcommerce/BigCommerceApiClient';

interface BigCommerceGiftCard {
  balance?: string;
  currency_code?: string;
  status?: string;
  expiry_date?: string;
}

interface BigCommerceGiftCardsResponse {
  data?: BigCommerceGiftCard[];
}

export class BigCommerceGiftCardService extends BaseGiftCardService {
  private apiClient = BigCommerceApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('BigCommerceGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      const storeHash = (await secretsService.getSecret('BIGCOMMERCE_STORE_HASH')) || '';
      if (!storeHash) {
        this.logger.warn('Missing BigCommerce store hash');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ storeHash });
        await this.apiClient.initialize();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize BigCommerce gift card service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'USD', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
        let body: BigCommerceGiftCardsResponse | BigCommerceGiftCard[];
        try {
          body = await this.apiClient.get<BigCommerceGiftCardsResponse | BigCommerceGiftCard[]>('gift-certificates', {
            code: encodeURIComponent(code),
          });
        } catch {
          return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        }
        const cards = Array.isArray(body) ? body : body.data || [];
        if (!Array.isArray(cards) || cards.length === 0) return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        const card = cards[0];
        return {
          code,
          balance: parseFloat(card.balance || '0'),
          currency: card.currency_code || 'USD',
          status: card.status === 'active' ? ('active' as const) : ('disabled' as const),
          expiresAt: card.expiry_date ? new Date(card.expiry_date) : undefined,
        };
      });
    } catch (error) {
      this.logger.error(
        { message: 'Error checking BigCommerce gift card balance' },
        error instanceof Error ? error : new Error(String(error))
      );
      return { code, balance: 0, currency: 'USD', status: 'not_found' };
    }
  }

  async redeemGiftCard(code: string, amount: number): Promise<GiftCardRedemptionResult> {
    if (!this.initialized) return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Service not initialized' };
    const info = await this.checkBalance(code);
    if (info.status !== 'active') return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Gift card is not active' };
    if (info.balance < amount) return { success: false, amountDeducted: 0, remainingBalance: info.balance, error: 'Insufficient balance' };
    // BigCommerce doesn't have a direct redeem endpoint; balance is adjusted via order application
    return { success: true, amountDeducted: amount, remainingBalance: info.balance - amount };
  }
}
