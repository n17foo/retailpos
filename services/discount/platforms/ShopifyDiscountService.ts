import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/tokenUtils';
import { TokenType } from '../../token/tokenServiceInterface';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';
import { SHOPIFY_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/secretsService';

export class ShopifyDiscountService extends BaseDiscountService {
  private storeUrl = '';
  private apiVersion = SHOPIFY_API_VERSION;

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('ShopifyDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.storeUrl = (await secretsService.getSecret('SHOPIFY_STORE_URL')) || process.env.SHOPIFY_STORE_URL || '';
      this.apiVersion = (await secretsService.getSecret('SHOPIFY_API_VERSION')) || SHOPIFY_API_VERSION;

      if (!this.storeUrl) {
        this.logger.warn('Missing Shopify store URL');
        return false;
      }

      this.storeUrl = this.storeUrl.replace(/\/+$/, '');
      if (!this.storeUrl.startsWith('https://')) {
        this.storeUrl = `https://${this.storeUrl}`;
      }

      const tokenInitialized = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.SHOPIFY);
      if (!tokenInitialized) {
        this.logger.warn('Failed to initialize Shopify token provider');
        return false;
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Shopify discount service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.SHOPIFY, TokenType.ACCESS);
    return {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token || '',
    };
  }

  async validateCoupon(code: string, basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) {
      return { valid: false, error: 'Discount service not initialized' };
    }

    try {
      return await withTokenRefresh(ECommercePlatform.SHOPIFY, async () => {
        // Shopify REST Admin API: look up price rules by title matching the discount code
        // First, find the discount code
        const url = `${this.storeUrl}/admin/api/${this.apiVersion}/discount_codes/lookup.json?code=${encodeURIComponent(code)}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers, redirect: 'follow' });

        if (!response.ok) {
          if (response.status === 404) {
            return { valid: false, error: 'Invalid discount code' };
          }
          throw new Error(`Shopify discount lookup failed: ${response.status}`);
        }

        const data = await response.json();
        const discountCode = data.discount_code;

        if (!discountCode) {
          return { valid: false, error: 'Invalid discount code' };
        }

        // Now fetch the associated price rule
        const priceRuleId = discountCode.price_rule_id;
        const priceRuleUrl = `${this.storeUrl}/admin/api/${this.apiVersion}/price_rules/${priceRuleId}.json`;
        const priceRuleResponse = await fetch(priceRuleUrl, { headers });

        if (!priceRuleResponse.ok) {
          return { valid: false, error: 'Could not verify discount details' };
        }

        const priceRuleData = await priceRuleResponse.json();
        const rule = priceRuleData.price_rule;

        // Check if the rule is active
        const now = new Date();
        if (rule.starts_at && new Date(rule.starts_at) > now) {
          return { valid: false, error: 'This discount is not yet active' };
        }
        if (rule.ends_at && new Date(rule.ends_at) < now) {
          return { valid: false, error: 'This discount has expired' };
        }

        // Check usage limits
        if (rule.usage_limit && discountCode.usage_count >= rule.usage_limit) {
          return { valid: false, error: 'This discount has reached its usage limit' };
        }

        // Check minimum purchase requirement
        const minSubtotal = rule.prerequisite_subtotal_range?.greater_than_or_equal_to;
        if (minSubtotal && basketTotal < parseFloat(minSubtotal)) {
          return {
            valid: false,
            error: `Minimum order total of ${minSubtotal} required`,
            minimumOrderTotal: parseFloat(minSubtotal),
          };
        }

        // Determine discount type and amount
        const valueType = rule.value_type; // 'percentage' or 'fixed_amount'
        const value = Math.abs(parseFloat(rule.value)); // Shopify stores as negative

        // Check for product-specific rules
        const productIds = rule.entitled_product_ids || [];
        const appliesToSpecific = productIds.length > 0;

        return {
          valid: true,
          description: rule.title || `Discount: ${code}`,
          discountType: valueType === 'percentage' ? 'percentage' : 'fixed_amount',
          amount: value,
          minimumOrderTotal: minSubtotal ? parseFloat(minSubtotal) : undefined,
          appliesToSpecificProducts: appliesToSpecific,
          applicableProductIds: appliesToSpecific ? productIds.map(String) : undefined,
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Error validating Shopify coupon' }, error instanceof Error ? error : new Error(String(error)));
      return { valid: false, error: 'Failed to validate discount code. Please try again.' };
    }
  }
}
