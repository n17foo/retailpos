import { BaseDiscountService } from './BaseDiscountService';
import { CouponValidationResult } from '../DiscountServiceInterface';
import { BasketItem } from '../../basket/basket';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { ShopifyApiClient } from '../../clients/shopify/ShopifyApiClient';

interface ShopifyDiscountLookupResponse {
  discount_code?: {
    price_rule_id?: number | string;
    usage_count?: number;
  };
}

interface ShopifyPriceRule {
  starts_at?: string;
  ends_at?: string;
  usage_limit?: number;
  prerequisite_subtotal_range?: { greater_than_or_equal_to?: string };
  value_type?: string;
  value?: string;
  entitled_product_ids?: Array<string | number>;
  title?: string;
}

interface ShopifyPriceRuleResponse {
  price_rule?: ShopifyPriceRule;
}

interface HttpLikeError {
  status?: number;
}

export class ShopifyDiscountService extends BaseDiscountService {
  private apiClient = ShopifyApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('ShopifyDiscountService');
  }

  async initialize(): Promise<boolean> {
    try {
      const storeUrl = (await secretsService.getSecret('SHOPIFY_STORE_URL')) || process.env.SHOPIFY_STORE_URL || '';

      if (!storeUrl) {
        this.logger.warn('Missing Shopify store URL');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ storeUrl });
        await this.apiClient.initialize();
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

  async validateCoupon(code: string, basketTotal: number, _items: BasketItem[]): Promise<CouponValidationResult> {
    if (!this.initialized) {
      return { valid: false, error: 'Discount service not initialized' };
    }

    try {
      return await withTokenRefresh(ECommercePlatform.SHOPIFY, async () => {
        // Shopify REST Admin API: look up price rules by title matching the discount code
        // First, find the discount code
        let data: ShopifyDiscountLookupResponse;
        try {
          data = await this.apiClient.get<ShopifyDiscountLookupResponse>(`discount_codes/lookup.json`, { code: encodeURIComponent(code) });
        } catch (error) {
          const typedError = error as HttpLikeError;
          if (typedError?.status === 404) return { valid: false, error: 'Invalid discount code' };
          throw error;
        }
        const discountCode = data.discount_code;

        if (!discountCode) {
          return { valid: false, error: 'Invalid discount code' };
        }

        // Now fetch the associated price rule
        const priceRuleId = discountCode.price_rule_id;
        let priceRuleData: ShopifyPriceRuleResponse;
        try {
          priceRuleData = await this.apiClient.get<ShopifyPriceRuleResponse>(`price_rules/${priceRuleId}.json`);
        } catch {
          return { valid: false, error: 'Could not verify discount details' };
        }
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
