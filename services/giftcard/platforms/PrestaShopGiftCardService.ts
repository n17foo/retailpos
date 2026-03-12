import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { PrestaShopApiClient } from '../../clients/prestashop/PrestaShopApiClient';

interface PrestaShopGiftCardRule {
  reduction_amount?: string;
  active?: string | boolean;
  reduction_currency?: string;
}

interface PrestaShopGiftCardRulesResponse {
  cart_rules?: PrestaShopGiftCardRule[];
}

export class PrestaShopGiftCardService extends BaseGiftCardService {
  private apiClient = PrestaShopApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('PrestaShopGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      const baseUrl = ((await secretsService.getSecret('PRESTASHOP_BASE_URL')) || '').replace(/\/+$/, '');
      if (!baseUrl) {
        this.logger.warn('Missing PrestaShop base URL');
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
        { message: 'Failed to initialize PrestaShop gift card service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'EUR', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
        // PrestaShop uses cart_rules with gift card type
        let body: PrestaShopGiftCardRulesResponse;
        try {
          body = await this.apiClient.get<PrestaShopGiftCardRulesResponse>(
            `cart_rules?filter[code]=${encodeURIComponent(code)}&display=full&output_format=JSON`
          );
        } catch {
          return { code, balance: 0, currency: 'EUR', status: 'not_found' as const };
        }
        const rules = body.cart_rules || [];
        if (rules.length === 0) return { code, balance: 0, currency: 'EUR', status: 'not_found' as const };
        const rule = rules[0];
        const balance = parseFloat(rule.reduction_amount || '0');
        const isActive = rule.active === '1' || rule.active === true;
        return {
          code,
          balance,
          currency: rule.reduction_currency || 'EUR',
          status: isActive ? ('active' as const) : ('disabled' as const),
        };
      });
    } catch (error) {
      this.logger.error(
        { message: 'Error checking PrestaShop gift card balance' },
        error instanceof Error ? error : new Error(String(error))
      );
      return { code, balance: 0, currency: 'EUR', status: 'not_found' };
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
