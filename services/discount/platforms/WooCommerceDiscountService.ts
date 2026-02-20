import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { WOOCOMMERCE_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/SecretsService';

export class WooCommerceDiscountService extends BaseDiscountService {
  private storeUrl = '';
  private apiVersion = WOOCOMMERCE_API_VERSION;

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('WooCommerceDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.storeUrl = (await secretsService.getSecret('WOOCOMMERCE_STORE_URL')) || process.env.WOOCOMMERCE_STORE_URL || '';

      if (!this.storeUrl) {
        this.logger.warn('Missing WooCommerce store URL');
        return false;
      }

      this.storeUrl = this.storeUrl.replace(/\/+$/, '');

      const tokenInitialized = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.WOOCOMMERCE);
      if (!tokenInitialized) {
        this.logger.warn('Failed to initialize WooCommerce token provider');
        return false;
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize WooCommerce discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.WOOCOMMERCE, TokenType.ACCESS);
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`,
    };
  }

  async validateCoupon(code: string, basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) {
      return { valid: false, error: 'Discount service not initialized' };
    }

    try {
      return await withTokenRefresh(ECommercePlatform.WOOCOMMERCE, async () => {
        const params = new URLSearchParams({ code });
        const url = `${this.storeUrl}/wp-json/${this.apiVersion}/coupons?${params.toString()}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`WooCommerce coupon lookup failed: ${response.status}`);
        }

        const coupons = await response.json();

        if (!Array.isArray(coupons) || coupons.length === 0) {
          return { valid: false, error: 'Invalid coupon code' };
        }

        const coupon = coupons[0];

        // Check expiry
        if (coupon.date_expires) {
          const expiryDate = new Date(coupon.date_expires);
          if (expiryDate < new Date()) {
            return { valid: false, error: 'This coupon has expired' };
          }
        }

        // Check usage limits
        if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
          return { valid: false, error: 'This coupon has reached its usage limit' };
        }

        // Check minimum amount
        const minAmount = coupon.minimum_amount ? parseFloat(coupon.minimum_amount) : 0;
        if (minAmount > 0 && basketTotal < minAmount) {
          return {
            valid: false,
            error: `Minimum order total of ${coupon.minimum_amount} required`,
            minimumOrderTotal: minAmount,
          };
        }

        // Check maximum amount
        const maxAmount = coupon.maximum_amount ? parseFloat(coupon.maximum_amount) : undefined;

        // Determine discount type
        // WooCommerce types: percent, fixed_cart, fixed_product
        let discountType: 'percentage' | 'fixed_amount';
        if (coupon.discount_type === 'percent') {
          discountType = 'percentage';
        } else {
          discountType = 'fixed_amount';
        }

        const amount = parseFloat(coupon.amount);

        // Product-specific coupons
        const productIds: string[] = coupon.product_ids || [];
        const appliesToSpecific = productIds.length > 0;

        return {
          valid: true,
          description: coupon.description || `Coupon: ${code}`,
          discountType,
          amount,
          minimumOrderTotal: minAmount > 0 ? minAmount : undefined,
          maximumDiscount: maxAmount,
          appliesToSpecificProducts: appliesToSpecific,
          applicableProductIds: appliesToSpecific ? productIds.map(String) : undefined,
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Error validating WooCommerce coupon' }, error instanceof Error ? error : new Error(String(error)));
      return { valid: false, error: 'Failed to validate coupon. Please try again.' };
    }
  }
}
