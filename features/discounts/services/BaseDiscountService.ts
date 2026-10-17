import { DiscountServiceInterface, DiscountValidationResult, DiscountCode } from './DiscountServiceInterface';
import { LoggerInterface } from '../../../shared/services/logger/LoggerInterface';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';

/**
 * Base Discount Service
 * Provides common discount validation logic
 */
export abstract class BaseDiscountService implements DiscountServiceInterface {
  protected logger: LoggerInterface;
  protected initialized = false;

  constructor(loggerName: string = 'BaseDiscountService') {
    this.logger = LoggerFactory.getInstance().createLogger(loggerName);
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    this.logger.info({ message: 'Discount service initialized' });
  }

  abstract validateDiscount(code: string, subtotal: number): Promise<DiscountValidationResult>;

  /**
   * Calculate discount amount based on type and value
   * @param type fixed or percentage
   * @param value cents for fixed, 0-100 for percentage
   * @param subtotal basket subtotal in cents
   * @param maximumDiscount optional maximum discount in cents (for percentage)
   * @returns discount amount in cents
   */
  protected calculateDiscountAmount(type: 'fixed' | 'percentage', value: number, subtotal: number, maximumDiscount?: number): number {
    if (type === 'fixed') {
      // Fixed discount: return the value, but don't exceed subtotal
      return Math.min(value, subtotal);
    } else {
      // Percentage discount: calculate percentage of subtotal
      const percentageAmount = Math.round((subtotal * value) / 100);

      // Apply maximum discount cap if specified
      if (maximumDiscount !== undefined) {
        return Math.min(percentageAmount, maximumDiscount, subtotal);
      }

      return Math.min(percentageAmount, subtotal);
    }
  }

  /**
   * Validate discount rules (minimum purchase, expiry, usage limits)
   * @param discount The discount code details
   * @param subtotal The basket subtotal in cents
   * @returns Validation result
   */
  protected validateDiscountRules(discount: DiscountCode, subtotal: number): { valid: boolean; error?: string } {
    // Check if discount is active
    if (!discount.active) {
      return { valid: false, error: 'Discount code is inactive' };
    }

    // Check start date
    if (discount.startsAt && new Date() < discount.startsAt) {
      return { valid: false, error: 'Discount code is not yet active' };
    }

    // Check expiry date
    if (discount.expiresAt && new Date() > discount.expiresAt) {
      return { valid: false, error: 'Discount code has expired' };
    }

    // Check minimum purchase requirement
    if (discount.minimumPurchase !== undefined && subtotal < discount.minimumPurchase) {
      return {
        valid: false,
        error: `Minimum purchase of $${(discount.minimumPurchase / 100).toFixed(2)} required`,
      };
    }

    // Check usage limit
    if (discount.usageLimit !== undefined && discount.usageCount !== undefined && discount.usageCount >= discount.usageLimit) {
      return { valid: false, error: 'Discount code usage limit reached' };
    }

    return { valid: true };
  }

  /**
   * Create an invalid discount result
   * @param code The discount code
   * @param error The error message
   * @returns Invalid discount result
   */
  protected createInvalidResult(code: string, error: string): DiscountValidationResult {
    return {
      valid: false,
      discountAmount: 0,
      discountType: 'fixed',
      discountValue: 0,
      code,
      error,
    };
  }

  /**
   * Create a valid discount result
   * @param discount The discount code details
   * @param subtotal The basket subtotal in cents
   * @returns Valid discount result
   */
  protected createValidResult(discount: DiscountCode, subtotal: number): DiscountValidationResult {
    const discountAmount = this.calculateDiscountAmount(discount.type, discount.value, subtotal, discount.maximumDiscount);

    return {
      valid: true,
      discountAmount,
      discountType: discount.type,
      discountValue: discount.value,
      code: discount.code,
      description: discount.description,
      minimumPurchase: discount.minimumPurchase,
      maximumDiscount: discount.maximumDiscount,
      expiresAt: discount.expiresAt,
      usageLimit: discount.usageLimit,
      usageCount: discount.usageCount,
    };
  }
}
