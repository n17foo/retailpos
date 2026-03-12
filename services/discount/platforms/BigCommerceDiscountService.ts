import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { BigCommerceApiClient } from '../../clients/bigcommerce/BigCommerceApiClient';

interface BigCommerceCoupon {
  enabled?: boolean;
  num_uses?: number;
  max_uses?: number;
  min_purchase?: string;
  type?: string;
  amount?: string;
  name?: string;
}

interface BigCommerceCouponsResponse {
  data?: BigCommerceCoupon[];
}

export class BigCommerceDiscountService extends BaseDiscountService {
  private apiClient = BigCommerceApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('BigCommerceDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      const storeHash = (await secretsService.getSecret('BIGCOMMERCE_STORE_HASH')) || '';
      if (!storeHash) {
        this.logger.warn('Missing BigCommerce store hash');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ storeHash });
        await this.apiClient.initialize();
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

  async validateCoupon(code: string, basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
        const body = await this.apiClient.get<BigCommerceCouponsResponse | BigCommerceCoupon[]>('coupons', {
          code: encodeURIComponent(code),
        });
        const coupons = Array.isArray(body) ? body : body.data || [];
        if (!Array.isArray(coupons) || coupons.length === 0) return { valid: false, error: 'Invalid coupon code' };
        const coupon = coupons[0];
        if (coupon.enabled === false) return { valid: false, error: 'This coupon is disabled' };
        if ((coupon.num_uses ?? 0) >= (coupon.max_uses ?? 0) && (coupon.max_uses ?? 0) > 0) {
          return { valid: false, error: 'Coupon usage limit reached' };
        }
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
