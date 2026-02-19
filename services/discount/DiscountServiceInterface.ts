import { BasketItem } from '../basket/basket';

/**
 * Result of validating a coupon/discount code against the platform.
 */
export interface CouponValidationResult {
  valid: boolean;
  /** Human-readable description of the discount (e.g. "20% off entire order") */
  description?: string;
  /** 'percentage' or 'fixed_amount' */
  discountType?: 'percentage' | 'fixed_amount';
  /** The discount value — percentage (0-100) or fixed amount in currency */
  amount?: number;
  /** Minimum order total required to use this coupon */
  minimumOrderTotal?: number;
  /** Maximum discount amount (cap for percentage discounts) */
  maximumDiscount?: number;
  /** Whether the coupon applies to specific products only */
  appliesToSpecificProducts?: boolean;
  /** Product IDs the coupon applies to (if appliesToSpecificProducts) */
  applicableProductIds?: string[];
  /** Error message when invalid */
  error?: string;
}

/**
 * Interface for discount/coupon operations.
 * Implementations call the e-commerce platform's coupon/discount API.
 * The POS does not create coupons — it validates and applies them.
 */
export interface DiscountServiceInterface {
  /**
   * Initialize the discount service
   */
  initialize(): Promise<boolean>;

  /**
   * Whether the service is ready
   */
  isInitialized(): boolean;

  /**
   * Validate a coupon code against the platform.
   * @param code The coupon/discount code entered by the cashier
   * @param basketTotal Current basket total before discount
   * @param items Current basket items (for product-specific coupons)
   */
  validateCoupon(code: string, basketTotal: number, items: BasketItem[]): Promise<CouponValidationResult>;

  /**
   * Calculate the actual discount amount for the given coupon and basket.
   * Call after validateCoupon returns valid=true.
   */
  calculateDiscount(validation: CouponValidationResult, basketTotal: number, items: BasketItem[]): number;
}
