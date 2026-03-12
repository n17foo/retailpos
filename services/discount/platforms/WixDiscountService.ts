import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { WixApiClient } from '../../clients/wix/WixApiClient';

interface WixCoupon {
  active?: boolean;
  expired?: boolean;
  percentOff?: number;
  moneyOffAmount?: number;
  name?: string;
}

interface WixCouponsResponse {
  coupons?: WixCoupon[];
}

export class WixDiscountService extends BaseDiscountService {
  private apiClient = WixApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('WixDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      const siteId = (await secretsService.getSecret('WIX_SITE_ID')) || '';
      if (!siteId) {
        this.logger.warn('Missing Wix site ID');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ siteId });
        await this.apiClient.initialize();
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

  async validateCoupon(code: string, _basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.WIX, async () => {
        const data = await this.apiClient.post<WixCouponsResponse>('stores/v2/coupons/query', { filter: { code: { $eq: code } } });
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
