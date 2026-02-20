import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { MAGENTO_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/SecretsService';

export class MagentoDiscountService extends BaseDiscountService {
  private baseUrl = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('MagentoDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.baseUrl = ((await secretsService.getSecret('MAGENTO_BASE_URL')) || '').replace(/\/+$/, '');
      if (!this.baseUrl) {
        this.logger.warn('Missing Magento base URL');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.MAGENTO);
      if (!ok) {
        this.logger.warn('Failed to initialize Magento token');
        return false;
      }
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Magento discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.MAGENTO, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
  }

  async validateCoupon(code: string, basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
        const searchUrl = `${this.baseUrl}/rest/${MAGENTO_API_VERSION}/coupons/search?searchCriteria[filterGroups][0][filters][0][field]=code&searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(code)}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(searchUrl, { headers });
        if (!response.ok) throw new Error(`Magento coupon lookup failed: ${response.status}`);
        const body = await response.json();
        if (!body.items?.length) return { valid: false, error: 'Invalid coupon code' };
        const coupon = body.items[0];
        if (!coupon.is_active) return { valid: false, error: 'This coupon is inactive' };
        // Fetch the associated sales rule for discount details
        const ruleUrl = `${this.baseUrl}/rest/${MAGENTO_API_VERSION}/salesRules/${coupon.rule_id}`;
        const ruleResponse = await fetch(ruleUrl, { headers });
        if (!ruleResponse.ok) return { valid: true, description: `Coupon: ${code}`, discountType: 'fixed_amount', amount: 0 };
        const rule = await ruleResponse.json();
        const discountType: 'percentage' | 'fixed_amount' = rule.simple_action === 'by_percent' ? 'percentage' : 'fixed_amount';
        const amount = parseFloat(rule.discount_amount || '0');
        return { valid: true, description: rule.name || `Coupon: ${code}`, discountType, amount };
      });
    } catch (error) {
      this.logger.error({ message: 'Error validating Magento coupon' }, error instanceof Error ? error : new Error(String(error)));
      return { valid: false, error: 'Failed to validate coupon' };
    }
  }
}
