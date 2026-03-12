import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { WixApiClient } from '../../clients/wix/WixApiClient';

interface WixGiftCardBalance {
  amount?: string;
  currency?: string;
}

interface WixGiftCardRecord {
  balance?: WixGiftCardBalance;
  status?: string;
  expirationDate?: string;
}

interface WixGiftCardLookupResponse {
  giftCard?: WixGiftCardRecord;
}

interface WixGiftCardRedeemResponse {
  giftCard?: WixGiftCardRecord;
  transactionId?: string;
}

export class WixGiftCardService extends BaseGiftCardService {
  private apiClient = WixApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('WixGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      const siteId = (await secretsService.getSecret('WIX_SITE_ID')) || '';
      if (!siteId) {
        this.logger.warn('Missing Wix site ID');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ siteId });
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

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'USD', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.WIX, async () => {
        let data: WixGiftCardLookupResponse | WixGiftCardRecord;
        try {
          data = await this.apiClient.get<WixGiftCardLookupResponse | WixGiftCardRecord>(`stores/v1/giftCards/${encodeURIComponent(code)}`);
        } catch {
          return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        }
        const lookupData = data as WixGiftCardLookupResponse;
        const card = lookupData.giftCard ?? (data as WixGiftCardRecord);
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
        const data = await this.apiClient.post<WixGiftCardRedeemResponse>(`stores/v1/giftCards/${encodeURIComponent(code)}/redeem`, {
          amount: { amount: String(amount) },
        });
        const remaining = data.giftCard?.balance?.amount ? parseFloat(data.giftCard.balance.amount) : 0;
        return { success: true, amountDeducted: amount, remainingBalance: remaining, transactionId: data.transactionId };
      });
    } catch (error) {
      this.logger.error({ message: 'Error redeeming Wix gift card' }, error instanceof Error ? error : new Error(String(error)));
      return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Failed to redeem gift card' };
    }
  }
}
