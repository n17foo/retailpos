/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';

export class SquarespaceDiscountService extends BaseDiscountService {
  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('SquarespaceDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.SQUARESPACE);
      if (!ok) {
        this.logger.warn('Failed to initialize Squarespace token');
        return false;
      }
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Squarespace discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.SQUARESPACE, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
  }

  async validateCoupon(code: string, _basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.SQUARESPACE, async () => {
        const headers = await this.getAuthHeaders();
        // Squarespace Commerce API: list discounts and find by promoCode
        const response = await fetch('https://api.squarespace.com/1.0/commerce/discounts', { headers });
        if (!response.ok) throw new Error(`Squarespace discount lookup failed: ${response.status}`);
        const body = await response.json();
        const discounts = body.discounts || [];
        const match = discounts.find((d: any) => d.promoCode?.toLowerCase() === code.toLowerCase());
        if (!match) return { valid: false, error: 'Invalid coupon code' };
        if (!match.enabled) return { valid: false, error: 'This coupon is inactive' };
        const isPercent = match.type === 'PERCENTAGE';
        const discountType: 'percentage' | 'fixed_amount' = isPercent ? 'percentage' : 'fixed_amount';
        const amount = match.amount?.value ? parseFloat(match.amount.value) : match.percentage || 0;
        return { valid: true, description: match.name || `Coupon: ${code}`, discountType, amount };
      });
    } catch (error) {
      this.logger.error({ message: 'Error validating Squarespace coupon' }, error instanceof Error ? error : new Error(String(error)));
      return { valid: false, error: 'Failed to validate coupon' };
    }
  }
}
