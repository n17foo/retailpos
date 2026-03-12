import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { WooCommerceApiClient } from '../../clients/woocommerce/WooCommerceApiClient';

interface WooCommerceGiftCard {
  balance?: string;
  currency?: string;
  active?: boolean;
  expiration_date?: string;
}

interface WooCommerceGiftCardRedeemResponse {
  balance?: string;
  id?: string | number;
}

export class WooCommerceGiftCardService extends BaseGiftCardService {
  private apiClient = WooCommerceApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('WooCommerceGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      const storeUrl = ((await secretsService.getSecret('WOOCOMMERCE_STORE_URL')) || '').replace(/\/+$/, '');
      if (!storeUrl) {
        this.logger.warn('Missing WooCommerce store URL');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ storeUrl });
        await this.apiClient.initialize();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize WooCommerce gift card service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'USD', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.WOOCOMMERCE, async () => {
        // WooCommerce uses the pw-gift-cards plugin endpoint
        let cards: WooCommerceGiftCard[];
        try {
          cards = await this.apiClient.get<WooCommerceGiftCard[]>('pw-gift-cards', { code: encodeURIComponent(code) });
        } catch {
          return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        }
        if (!Array.isArray(cards) || cards.length === 0) return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        const card = cards[0];
        return {
          code,
          balance: parseFloat(card.balance || '0'),
          currency: card.currency || 'USD',
          status: card.active ? ('active' as const) : ('disabled' as const),
          expiresAt: card.expiration_date ? new Date(card.expiration_date) : undefined,
        };
      });
    } catch (error) {
      this.logger.error(
        { message: 'Error checking WooCommerce gift card balance' },
        error instanceof Error ? error : new Error(String(error))
      );
      return { code, balance: 0, currency: 'USD', status: 'not_found' };
    }
  }

  async redeemGiftCard(code: string, amount: number): Promise<GiftCardRedemptionResult> {
    if (!this.initialized) return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.WOOCOMMERCE, async () => {
        const data = await this.apiClient.post<WooCommerceGiftCardRedeemResponse>('pw-gift-cards/redeem', { code, amount });
        return {
          success: true,
          amountDeducted: amount,
          remainingBalance: parseFloat(data.balance || '0'),
          transactionId: data.id ? String(data.id) : undefined,
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Error redeeming WooCommerce gift card' }, error instanceof Error ? error : new Error(String(error)));
      return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Failed to redeem gift card' };
    }
  }
}
