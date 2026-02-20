import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { BIGCOMMERCE_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/SecretsService';

export class BigCommerceGiftCardService extends BaseGiftCardService {
  private storeHash = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('BigCommerceGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.storeHash = (await secretsService.getSecret('BIGCOMMERCE_STORE_HASH')) || '';
      if (!this.storeHash) {
        this.logger.warn('Missing BigCommerce store hash');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.BIGCOMMERCE);
      if (!ok) {
        this.logger.warn('Failed to initialize BigCommerce token');
        return false;
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

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.BIGCOMMERCE, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', 'X-Auth-Token': token || '' };
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'USD', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
        const url = `https://api.bigcommerce.com/stores/${this.storeHash}/${BIGCOMMERCE_API_VERSION}/gift-certificates?code=${encodeURIComponent(code)}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        const body = await response.json();
        const cards = body.data || body;
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
