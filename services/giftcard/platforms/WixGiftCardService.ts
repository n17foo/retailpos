import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/tokenUtils';
import { TokenType } from '../../token/tokenServiceInterface';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';
import secretsService from '../../secrets/secretsService';

export class WixGiftCardService extends BaseGiftCardService {
  private siteId = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('WixGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.siteId = (await secretsService.getSecret('WIX_SITE_ID')) || '';
      if (!this.siteId) {
        this.logger.warn('Missing Wix site ID');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.WIX);
      if (!ok) {
        this.logger.warn('Failed to initialize Wix token');
        return false;
      }
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Wix gift card service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.WIX, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: token || '', 'wix-site-id': this.siteId };
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'USD', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.WIX, async () => {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`https://www.wixapis.com/stores/v1/giftCards/${encodeURIComponent(code)}`, { headers });
        if (!response.ok) return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        const data = await response.json();
        const card = data.giftCard || data;
        return {
          code,
          balance: card.balance?.amount ? parseFloat(card.balance.amount) : 0,
          currency: card.balance?.currency || 'USD',
          status: card.status === 'ACTIVE' ? ('active' as const) : ('disabled' as const),
          expiresAt: card.expirationDate ? new Date(card.expirationDate) : undefined,
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Error checking Wix gift card balance' }, error instanceof Error ? error : new Error(String(error)));
      return { code, balance: 0, currency: 'USD', status: 'not_found' };
    }
  }

  async redeemGiftCard(code: string, amount: number): Promise<GiftCardRedemptionResult> {
    if (!this.initialized) return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.WIX, async () => {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`https://www.wixapis.com/stores/v1/giftCards/${encodeURIComponent(code)}/redeem`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ amount: { amount: String(amount) } }),
        });
        if (!response.ok) return { success: false, amountDeducted: 0, remainingBalance: 0, error: `Redemption failed: ${response.status}` };
        const data = await response.json();
        const remaining = data.giftCard?.balance?.amount ? parseFloat(data.giftCard.balance.amount) : 0;
        return { success: true, amountDeducted: amount, remainingBalance: remaining, transactionId: data.transactionId };
      });
    } catch (error) {
      this.logger.error({ message: 'Error redeeming Wix gift card' }, error instanceof Error ? error : new Error(String(error)));
      return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Failed to redeem gift card' };
    }
  }
}
