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

export class SyliusDiscountService extends BaseDiscountService {
  private baseUrl = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('SyliusDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.baseUrl = ((await secretsService.getSecret('SYLIUS_BASE_URL')) || '').replace(/\/+$/, '');
      if (!this.baseUrl) {
        this.logger.warn('Missing Sylius base URL');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.SYLIUS);
      if (!ok) {
        this.logger.warn('Failed to initialize Sylius token');
        return false;
      }
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Sylius discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.SYLIUS, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
  }

  async validateCoupon(code: string, _basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.SYLIUS, async () => {
        const url = `${this.baseUrl}/api/v2/shop/promotion-coupons/${encodeURIComponent(code)}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) {
          if (response.status === 404) return { valid: false, error: 'Invalid coupon code' };
          throw new Error(`Sylius coupon lookup failed: ${response.status}`);
        }
        const coupon = await response.json();
        if (coupon.used >= coupon.usageLimit && coupon.usageLimit > 0) return { valid: false, error: 'Coupon usage limit reached' };
        if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { valid: false, error: 'This coupon has expired' };
        // Sylius promotions are rule-based; return generic valid result
        return { valid: true, description: coupon.promotion?.name || `Coupon: ${code}`, discountType: 'percentage', amount: 0 };
      });
    } catch (error) {
      this.logger.error({ message: 'Error validating Sylius coupon' }, error instanceof Error ? error : new Error(String(error)));
      return { valid: false, error: 'Failed to validate coupon' };
    }
  }
}
