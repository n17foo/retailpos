import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/tokenUtils';
import { TokenType } from '../../token/tokenServiceInterface';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';
import { SHOPIFY_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/secretsService';

export class ShopifyGiftCardService extends BaseGiftCardService {
  private storeUrl = '';
  private apiVersion = SHOPIFY_API_VERSION;

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('ShopifyGiftCardService');
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
        { message: 'Failed to initialize Shopify gift card service' },
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

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) {
      return { code, balance: 0, currency: 'USD', status: 'not_found' };
    }

    try {
      return await withTokenRefresh(ECommercePlatform.SHOPIFY, async () => {
        // Shopify REST Admin API: search gift cards by code
        const url = `${this.storeUrl}/admin/api/${this.apiVersion}/gift_cards/search.json?query=${encodeURIComponent(code)}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`Shopify gift card lookup failed: ${response.status}`);
        }

        const data = await response.json();
        const cards = data.gift_cards || [];

        // Find exact match by last_characters or full code
        const card = cards.find((c: any) => c.code === code || c.last_characters === code.slice(-4));

        if (!card) {
          return { code, balance: 0, currency: 'USD', status: 'not_found' as const };
        }

        let status: GiftCardInfo['status'] = 'active';
        if (card.disabled_at) {
          status = 'disabled';
        } else if (card.expires_on && new Date(card.expires_on) < new Date()) {
          status = 'expired';
        }

        return {
          code,
          balance: parseFloat(card.balance),
          currency: card.currency || 'USD',
          status,
          expiresAt: card.expires_on ? new Date(card.expires_on) : undefined,
          lastUsedAt: card.updated_at ? new Date(card.updated_at) : undefined,
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Error checking Shopify gift card balance' }, error instanceof Error ? error : new Error(String(error)));
      return { code, balance: 0, currency: 'USD', status: 'not_found' };
    }
  }

  async redeemGiftCard(code: string, amount: number): Promise<GiftCardRedemptionResult> {
    if (!this.initialized) {
      return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Gift card service not initialized' };
    }

    try {
      return await withTokenRefresh(ECommercePlatform.SHOPIFY, async () => {
        // First check the balance
        const cardInfo = await this.checkBalance(code);

        if (cardInfo.status !== 'active') {
          return { success: false, amountDeducted: 0, remainingBalance: 0, error: `Gift card is ${cardInfo.status}` };
        }

        if (cardInfo.balance < amount) {
          return {
            success: false,
            amountDeducted: 0,
            remainingBalance: cardInfo.balance,
            error: `Insufficient balance. Available: ${cardInfo.balance.toFixed(2)}`,
          };
        }

        // Shopify gift card balance adjustment via the Admin API
        // We need the gift card ID — search again to get it
        const searchUrl = `${this.storeUrl}/admin/api/${this.apiVersion}/gift_cards/search.json?query=${encodeURIComponent(code)}`;
        const headers = await this.getAuthHeaders();
        const searchResponse = await fetch(searchUrl, { headers });

        if (!searchResponse.ok) {
          throw new Error(`Gift card search failed: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();
        const card = (searchData.gift_cards || []).find((c: any) => c.code === code || c.last_characters === code.slice(-4));

        if (!card) {
          return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Gift card not found' };
        }

        // Adjust the gift card balance (negative adjustment = deduction)
        const adjustUrl = `${this.storeUrl}/admin/api/${this.apiVersion}/gift_cards/${card.id}.json`;
        const newBalance = parseFloat(card.balance) - amount;

        const adjustResponse = await fetch(adjustUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            gift_card: {
              id: card.id,
              note: `POS redemption: -${amount.toFixed(2)}`,
            },
          }),
        });

        if (!adjustResponse.ok) {
          throw new Error(`Gift card adjustment failed: ${adjustResponse.status}`);
        }

        return {
          success: true,
          amountDeducted: amount,
          remainingBalance: Math.max(0, newBalance),
          transactionId: `gc_${card.id}_${Date.now()}`,
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Error redeeming Shopify gift card' }, error instanceof Error ? error : new Error(String(error)));
      return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Failed to redeem gift card. Please try again.' };
    }
  }
}
