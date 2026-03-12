import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { MagentoApiClient } from '../../clients/magento/MagentoApiClient';

interface MagentoCoupon {
  is_active?: boolean;
  rule_id?: number | string;
}

interface MagentoCouponsResponse {
  items: MagentoCoupon[];
}

interface MagentoSalesRule {
  simple_action?: string;
  discount_amount?: string;
  name?: string;
}

export class MagentoDiscountService extends BaseDiscountService {
  private apiClient = MagentoApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('MagentoDiscountService');
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
        { message: 'Failed to initialize Magento discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async validateCoupon(code: string, _basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
        const params = {
          'searchCriteria[filterGroups][0][filters][0][field]': 'code',
          'searchCriteria[filterGroups][0][filters][0][value]': encodeURIComponent(code),
        };
        const body = await this.apiClient.get<MagentoCouponsResponse>('coupons/search', params);
        if (!body.items?.length) return { valid: false, error: 'Invalid coupon code' };
        const coupon = body.items[0];
        if (!coupon.is_active) return { valid: false, error: 'This coupon is inactive' };
        // Fetch the associated sales rule for discount details
        let rule: MagentoSalesRule;
        try {
          rule = await this.apiClient.get<MagentoSalesRule>(`salesRules/${coupon.rule_id}`);
        } catch {
          return { valid: true, description: `Coupon: ${code}`, discountType: 'fixed_amount', amount: 0 };
        }
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
