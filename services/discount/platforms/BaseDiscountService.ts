import { DiscountServiceInterface, CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { LoggerFactory } from '../../logger/loggerFactory';

/**
 * Base abstract class for platform-specific discount service implementations.
 */
export abstract class BaseDiscountService implements DiscountServiceInterface {
  protected initialized = false;
  protected logger = LoggerFactory.getInstance().createLogger('BaseDiscountService');

  abstract initialize(): Promise<boolean>;

  isInitialized(): boolean {
    return this.initialized;
  }

  abstract validateCoupon(code: string, basketTotal: number, items: BasketItem[]): Promise<CouponValidationResult>;

  /**
   * Default discount calculation logic.
   * Platform services can override for custom behaviour.
   */
  calculateDiscount(validation: CouponValidationResult, basketTotal: number, items: BasketItem[]): number {
    if (!validation.valid || !validation.amount || !validation.discountType) {
      return 0;
    }

    let discount = 0;

    if (validation.discountType === 'fixed_amount') {
      discount = validation.amount;
    } else if (validation.discountType === 'percentage') {
      // If the coupon applies to specific products, only discount those
      if (validation.appliesToSpecificProducts && validation.applicableProductIds?.length) {
        const applicableTotal = items
          .filter(i => validation.applicableProductIds!.includes(i.productId))
          .reduce((sum, i) => sum + i.price * i.quantity, 0);
        discount = (applicableTotal * validation.amount) / 100;
      } else {
        discount = (basketTotal * validation.amount) / 100;
      }
    }

    // Apply maximum discount cap if set
    if (validation.maximumDiscount && discount > validation.maximumDiscount) {
      discount = validation.maximumDiscount;
    }

    // Never discount more than the basket total
    if (discount > basketTotal) {
      discount = basketTotal;
    }

    // Round to 2 decimal places
    return Math.round(discount * 100) / 100;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }
}
