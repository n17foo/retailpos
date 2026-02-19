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

export class WixDiscountService extends BaseDiscountService {
  private siteId = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('WixDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.siteId = (await secretsService.getSecret('WIX_SITE_ID')) || '';
      if (!this.siteId) {
        this.logger.warn('Missing Wix site ID');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.WIX);
      if (!ok) {
        this.logger.warn('Failed to initialize Wix token');
        return false;
      }
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Wix discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.WIX, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: token || '', 'wix-site-id': this.siteId };
  }

  async validateCoupon(code: string, _basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.WIX, async () => {
        const headers = await this.getAuthHeaders();
        const body = { filter: { code: { $eq: code } } };
        const response = await fetch('https://www.wixapis.com/stores/v2/coupons/query', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`Wix coupon lookup failed: ${response.status}`);
        const data = await response.json();
        const coupons = data.coupons || [];
        if (coupons.length === 0) return { valid: false, error: 'Invalid coupon code' };
        const coupon = coupons[0];
        if (!coupon.active) return { valid: false, error: 'This coupon is inactive' };
        if (coupon.expired) return { valid: false, error: 'This coupon has expired' };
        const discountType: 'percentage' | 'fixed_amount' = coupon.percentOff ? 'percentage' : 'fixed_amount';
        const amount = coupon.percentOff || coupon.moneyOffAmount || 0;
        return { valid: true, description: coupon.name || `Coupon: ${code}`, discountType, amount };
      });
    } catch (error) {
      this.logger.error({ message: 'Error validating Wix coupon' }, error instanceof Error ? error : new Error(String(error)));
      return { valid: false, error: 'Failed to validate coupon' };
    }
  }
}
