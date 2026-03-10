/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { DiscountServiceInterface, CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { CommerceFullApiClient, CommerceFullConfig } from '../../clients/commercefull/CommerceFullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * CommerceFull platform implementation of the discount/coupon service.
 *
 * Endpoint mapping:
 *   POST /customer/coupons/validate     → validateCoupon
 *   POST /business/coupons/calculate    → calculateDiscount (server-side)
 */
export class CommerceFullDiscountService implements DiscountServiceInterface {
  private initialized = false;
  private config: Record<string, any>;
  private apiClient: CommerceFullApiClient;
  private logger = LoggerFactory.getInstance().createLogger('CommerceFullDiscountService');

  constructor(config: Record<string, any> = {}) {
    this.config = config;
    this.apiClient = CommerceFullApiClient.getInstance();
  }

  async initialize(): Promise<boolean> {
    try {
      const clientConfig: CommerceFullConfig = {
        storeUrl: this.config.storeUrl,
        apiKey: this.config.apiKey,
        apiSecret: this.config.apiSecret,
        apiVersion: this.config.apiVersion,
      };

      this.apiClient.configure(clientConfig);
      const ok = await this.apiClient.initialize();
      if (ok) this.initialized = true;
      return ok;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize CommerceFull discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async validateCoupon(code: string, basketTotal: number, items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull discount service not initialized');
    }

    try {
      const data = await this.apiClient.post<any>('/customer/coupons/validate', {
        code,
        basketTotal,
        items: items.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      const result = data.data || data;
      return {
        valid: result.valid ?? result.isValid ?? false,
        description: result.description || result.message || '',
        discountType: result.discountType || result.type,
        amount: result.amount ?? result.value,
        minimumOrderTotal: result.minimumOrderTotal || result.minOrderAmount,
        maximumDiscount: result.maximumDiscount || result.maxDiscount,
        appliesToSpecificProducts: result.appliesToSpecificProducts ?? false,
        applicableProductIds: result.applicableProductIds || [],
        error: result.error || undefined,
      };
    } catch (error) {
      this.logger.error(
        { message: `Error validating coupon ${code} on CommerceFull` },
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate coupon',
      };
    }
  }

  calculateDiscount(validation: CouponValidationResult, basketTotal: number, items: BasketItem[]): number {
    if (!validation.valid || !validation.amount) return 0;

    let discount = 0;

    if (validation.discountType === 'percentage') {
      if (validation.appliesToSpecificProducts && validation.applicableProductIds?.length) {
        const applicableTotal = items
          .filter(item => validation.applicableProductIds!.includes(item.id))
          .reduce((sum, item) => sum + item.price * item.quantity, 0);
        discount = (applicableTotal * validation.amount) / 100;
      } else {
        discount = (basketTotal * validation.amount) / 100;
      }

      if (validation.maximumDiscount) {
        discount = Math.min(discount, validation.maximumDiscount);
      }
    } else if (validation.discountType === 'fixed_amount') {
      discount = validation.amount;
    }

    return Math.min(discount, basketTotal);
  }
}
