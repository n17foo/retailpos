import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/tokenUtils';
import { TokenType } from '../../token/tokenServiceInterface';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';
import secretsService from '../../secrets/secretsService';

export class PrestaShopDiscountService extends BaseDiscountService {
  private baseUrl = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('PrestaShopDiscountService');
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
        { message: 'Failed to initialize PrestaShop discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.PRESTASHOP, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(token + ':')}`, 'Output-Format': 'JSON' };
  }

  async validateCoupon(code: string, _basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
        const url = `${this.baseUrl}/api/cart_rules?filter[code]=${encodeURIComponent(code)}&display=full&output_format=JSON`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`PrestaShop coupon lookup failed: ${response.status}`);
        const body = await response.json();
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
