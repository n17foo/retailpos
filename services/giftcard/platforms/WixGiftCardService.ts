import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { WixApiClient } from '../../clients/wix/WixApiClient';

export class WixGiftCardService extends BaseGiftCardService {
  private siteId = '';
  private apiClient = WixApiClient.getInstance();

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

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ siteId: this.siteId });
        await this.apiClient.initialize();
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
    return this.apiClient['buildHeaders']();
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
