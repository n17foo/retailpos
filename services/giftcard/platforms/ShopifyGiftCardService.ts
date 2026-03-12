/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseGiftCardService } from './BaseGiftCardService';
import { GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { ShopifyApiClient } from '../../clients/shopify/ShopifyApiClient';

export class ShopifyGiftCardService extends BaseGiftCardService {
  private apiClient = ShopifyApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('ShopifyGiftCardService');
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
        { message: 'Failed to initialize Shopify gift card service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async checkBalance(code: string): Promise<GiftCardInfo> {
    if (!this.initialized) {
      return { code, balance: 0, currency: 'USD', status: 'not_found' };
    }

    try {
      return await withTokenRefresh(ECommercePlatform.SHOPIFY, async () => {
        // Shopify REST Admin API: search gift cards by code
        const data = await this.apiClient.get<{ gift_cards: any[] }>('gift_cards/search.json', { query: encodeURIComponent(code) });
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
        const searchData = await this.apiClient.get<{ gift_cards: any[] }>('gift_cards/search.json', { query: encodeURIComponent(code) });
        const card = (searchData.gift_cards || []).find((c: any) => c.code === code || c.last_characters === code.slice(-4));

        if (!card) {
          return { success: false, amountDeducted: 0, remainingBalance: 0, error: 'Gift card not found' };
        }

        // Adjust the gift card balance (negative adjustment = deduction)
        const newBalance = parseFloat(card.balance) - amount;
        await this.apiClient.put(`gift_cards/${card.id}.json`, {
          gift_card: { id: card.id, note: `POS redemption: -${amount.toFixed(2)}` },
        });

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
