/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { SquarespaceApiClient } from '../../clients/squarespace/SquarespaceApiClient';

export class SquarespaceDiscountService extends BaseDiscountService {
  private apiClient = SquarespaceApiClient.getInstance();
  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('SquarespaceDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.apiClient.isInitialized()) {
        await this.apiClient.initialize();
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

  async validateCoupon(code: string, _basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) return { valid: false, error: 'Discount service not initialized' };
    try {
      return await withTokenRefresh(ECommercePlatform.SQUARESPACE, async () => {
        // Squarespace Commerce API: list discounts and find by promoCode
        const body = await this.apiClient.get<any>('commerce/discounts');
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
