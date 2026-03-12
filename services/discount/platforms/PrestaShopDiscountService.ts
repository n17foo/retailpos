import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { PrestaShopApiClient } from '../../clients/prestashop/PrestaShopApiClient';

interface PrestaShopCartRule {
  active?: string | boolean;
  date_to?: string;
  reduction_percent?: string;
  reduction_amount?: string;
  name?: string;
}

interface PrestaShopCartRulesResponse {
  cart_rules?: PrestaShopCartRule[];
}

export class PrestaShopDiscountService extends BaseDiscountService {
  private apiClient = PrestaShopApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('PrestaShopDiscountService');
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
        { message: 'Failed to initialize PrestaShop discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async validateCoupon(code: string, _basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
        const body = await this.apiClient.get<PrestaShopCartRulesResponse>(
          `cart_rules?filter[code]=${encodeURIComponent(code)}&display=full&output_format=JSON`
        );
        const rules = body.cart_rules || [];
        if (rules.length === 0) return { valid: false, error: 'Invalid coupon code' };
        const rule = rules[0];
        if (rule.active === '0' || rule.active === false) return { valid: false, error: 'This coupon is inactive' };
        if (rule.date_to && new Date(rule.date_to) < new Date()) return { valid: false, error: 'This coupon has expired' };
        const isPercent = rule.reduction_percent && parseFloat(rule.reduction_percent) > 0;
        const discountType: 'percentage' | 'fixed_amount' = isPercent ? 'percentage' : 'fixed_amount';
        const amount = isPercent ? parseFloat(rule.reduction_percent) : parseFloat(rule.reduction_amount || '0');
        return { valid: true, description: rule.name || `Coupon: ${code}`, discountType, amount };
      });
    } catch (error) {
      this.logger.error({ message: 'Error validating PrestaShop coupon' }, error instanceof Error ? error : new Error(String(error)));
      return { valid: false, error: 'Failed to validate coupon' };
    }
  }
}
