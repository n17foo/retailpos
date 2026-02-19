import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/tokenUtils';
import { TokenType } from '../../token/tokenServiceInterface';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';
import secretsService from '../../secrets/secretsService';

export class SquarespaceGiftCardService extends BaseGiftCardService {
  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('SquarespaceGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.SQUARESPACE);
      if (!ok) {
        this.logger.warn('Failed to initialize Squarespace token');
        return false;
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

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.SQUARESPACE, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'USD', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.SQUARESPACE, async () => {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`https://api.squarespace.com/1.0/commerce/gift-cards/${encodeURIComponent(code)}`, { headers });
        if (!response.ok) return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        const card = await response.json();
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
