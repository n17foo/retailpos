import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { SquarespaceApiClient } from '../../clients/squarespace/SquarespaceApiClient';

interface SquarespaceGiftCard {
  balance?: {
    value?: string;
    currency?: string;
  };
  status?: string;
}

export class SquarespaceGiftCardService extends BaseGiftCardService {
  private apiClient = SquarespaceApiClient.getInstance();
  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('SquarespaceGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.apiClient.isInitialized()) {
        await this.apiClient.initialize();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Squarespace gift card service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'USD', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.SQUARESPACE, async () => {
        let card: SquarespaceGiftCard;
        try {
          card = await this.apiClient.get<SquarespaceGiftCard>(`commerce/gift-cards/${encodeURIComponent(code)}`);
        } catch {
          return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        }
        return {
          code,
          balance: card.balance?.value ? parseFloat(card.balance.value) : 0,
          currency: card.balance?.currency || 'USD',
          status: card.status === 'ACTIVE' ? ('active' as const) : ('disabled' as const),
        };
      });
    } catch (error) {
      this.logger.error(
        { message: 'Error checking Squarespace gift card balance' },
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
    return { success: true, amountDeducted: amount, remainingBalance: info.balance - amount };
  }
}
