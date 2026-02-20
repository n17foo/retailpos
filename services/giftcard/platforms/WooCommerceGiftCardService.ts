import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { WOOCOMMERCE_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/SecretsService';

export class WooCommerceGiftCardService extends BaseGiftCardService {
  private storeUrl = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('WooCommerceGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.storeUrl = ((await secretsService.getSecret('WOOCOMMERCE_STORE_URL')) || '').replace(/\/+$/, '');
      if (!this.storeUrl) {
        this.logger.warn('Missing WooCommerce store URL');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.WOOCOMMERCE);
      if (!ok) {
        this.logger.warn('Failed to initialize WooCommerce token');
        return false;
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

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.WOOCOMMERCE, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'USD', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.WOOCOMMERCE, async () => {
        // WooCommerce uses the pw-gift-cards plugin endpoint
        const url = `${this.storeUrl}/wp-json/${WOOCOMMERCE_API_VERSION}/pw-gift-cards?code=${encodeURIComponent(code)}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        const cards = await response.json();
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
        const url = `${this.storeUrl}/wp-json/${WOOCOMMERCE_API_VERSION}/pw-gift-cards/redeem`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ code, amount }) });
        if (!response.ok) return { success: false, amountDeducted: 0, remainingBalance: 0, error: `Redemption failed: ${response.status}` };
        const data = await response.json();
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
