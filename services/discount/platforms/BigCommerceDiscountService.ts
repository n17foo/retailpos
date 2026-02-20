import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { BIGCOMMERCE_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/SecretsService';

export class BigCommerceDiscountService extends BaseDiscountService {
  private storeHash = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('BigCommerceDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.storeHash = (await secretsService.getSecret('BIGCOMMERCE_STORE_HASH')) || '';
      if (!this.storeHash) {
        this.logger.warn('Missing BigCommerce store hash');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.BIGCOMMERCE);
      if (!ok) {
        this.logger.warn('Failed to initialize BigCommerce token');
        return false;
      }
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize BigCommerce discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.BIGCOMMERCE, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', 'X-Auth-Token': token || '' };
  }

  async validateCoupon(code: string, basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
        const url = `https://api.bigcommerce.com/stores/${this.storeHash}/${BIGCOMMERCE_API_VERSION}/coupons?code=${encodeURIComponent(code)}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`BigCommerce coupon lookup failed: ${response.status}`);
        const body = await response.json();
        const coupons = body.data || body;
        if (!Array.isArray(coupons) || coupons.length === 0) return { valid: false, error: 'Invalid coupon code' };
        const coupon = coupons[0];
        if (coupon.enabled === false) return { valid: false, error: 'This coupon is disabled' };
        if (coupon.num_uses >= coupon.max_uses && coupon.max_uses > 0) return { valid: false, error: 'Coupon usage limit reached' };
        const minPurchase = coupon.min_purchase ? parseFloat(coupon.min_purchase) : 0;
        if (minPurchase > 0 && basketTotal < minPurchase)
          return { valid: false, error: `Minimum purchase of ${minPurchase} required`, minimumOrderTotal: minPurchase };
        const discountType: 'percentage' | 'fixed_amount' = coupon.type?.includes('percent') ? 'percentage' : 'fixed_amount';
        const amount = parseFloat(coupon.amount || '0');
        return {
          valid: true,
          description: coupon.name || `Coupon: ${code}`,
          discountType,
          amount,
          minimumOrderTotal: minPurchase > 0 ? minPurchase : undefined,
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Error validating BigCommerce coupon' }, error instanceof Error ? error : new Error(String(error)));
      return { valid: false, error: 'Failed to validate coupon' };
    }
  }
}
