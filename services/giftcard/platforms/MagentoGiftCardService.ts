import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { MagentoApiClient } from '../../clients/magento/MagentoApiClient';

interface MagentoGiftCardAccount {
  balance?: string;
  currency_code?: string;
  status?: number;
  date_expires?: string;
}

export class MagentoGiftCardService extends BaseGiftCardService {
  private apiClient = MagentoApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('MagentoGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      const baseUrl = ((await secretsService.getSecret('MAGENTO_BASE_URL')) || '').replace(/\/+$/, '');
      if (!baseUrl) {
        this.logger.warn('Missing Magento base URL');
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
        { message: 'Failed to initialize Magento gift card service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'USD', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
        let card: MagentoGiftCardAccount;
        try {
          card = await this.apiClient.get<MagentoGiftCardAccount>(`giftCardAccount/${encodeURIComponent(code)}`);
        } catch {
          return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        }
        const statusMap: Record<number, GiftCardInfo['status']> = { 0: 'active', 1: 'disabled', 2: 'expired' };
        return {
          code,
          balance: parseFloat(card.balance || '0'),
          currency: card.currency_code || 'USD',
          status: statusMap[card.status] || 'active',
          expiresAt: card.date_expires ? new Date(card.date_expires) : undefined,
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Error checking Magento gift card balance' }, error instanceof Error ? error : new Error(String(error)));
      return { code, balance: 0, currency: 'USD', status: 'not_found' };
    }
  }

  async redeemGiftCard(code: string, amount: number): Promise<GiftCardRedemptionResult> {
    if (!this.initialized) return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Service not initialized' };
    const info = await this.checkBalance(code);
    if (info.status !== 'active') return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Gift card is not active' };
    if (info.balance < amount) return { success: false, amountDeducted: 0, remainingBalance: info.balance, error: 'Insufficient balance' };
    // Magento gift card redemption is handled via cart/order application
    return { success: true, amountDeducted: amount, remainingBalance: info.balance - amount };
  }
}
