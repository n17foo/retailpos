import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { SyliusApiClient } from '../../clients/sylius/SyliusApiClient';

interface SyliusGiftCard {
  amount?: number;
  currencyCode?: string;
  enabled?: boolean;
  expiresAt?: string;
}

export class SyliusGiftCardService extends BaseGiftCardService {
  private apiClient = SyliusApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('SyliusGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      const baseUrl = ((await secretsService.getSecret('SYLIUS_BASE_URL')) || '').replace(/\/+$/, '');
      if (!baseUrl) {
        this.logger.warn('Missing Sylius base URL');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ storeUrl: baseUrl });
        await this.apiClient.initialize();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Sylius gift card service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'USD', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.SYLIUS, async () => {
        // Sylius gift card plugin endpoint
        let card: SyliusGiftCard;
        try {
          card = await this.apiClient.get<SyliusGiftCard>(`api/v2/shop/gift-cards/${encodeURIComponent(code)}`);
        } catch {
          return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        }
        return {
          code,
          balance: card.amount || 0,
          currency: card.currencyCode || 'USD',
          status: card.enabled ? ('active' as const) : ('disabled' as const),
          expiresAt: card.expiresAt ? new Date(card.expiresAt) : undefined,
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Error checking Sylius gift card balance' }, error instanceof Error ? error : new Error(String(error)));
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
