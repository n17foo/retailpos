import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';

export class PrestaShopGiftCardService extends BaseGiftCardService {
  private baseUrl = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('PrestaShopGiftCardService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.baseUrl = ((await secretsService.getSecret('PRESTASHOP_BASE_URL')) || '').replace(/\/+$/, '');
      if (!this.baseUrl) {
        this.logger.warn('Missing PrestaShop base URL');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.PRESTASHOP);
      if (!ok) {
        this.logger.warn('Failed to initialize PrestaShop token');
        return false;
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

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.PRESTASHOP, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(token + ':')}`, 'Output-Format': 'JSON' };
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) return { code, balance: 0, currency: 'EUR', status: 'not_found' };
    try {
      return await withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
        // PrestaShop uses cart_rules with gift card type
        const url = `${this.baseUrl}/api/cart_rules?filter[code]=${encodeURIComponent(code)}&display=full&output_format=JSON`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) return { code, balance: 0, currency: 'EUR', status: 'not_found' as const };
        const body = await response.json();
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
