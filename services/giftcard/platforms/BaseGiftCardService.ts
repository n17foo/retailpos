import { GiftCardServiceInterface, GiftCardInfo, GiftCardRedemptionResult } from '../GiftCardServiceInterface';
import { LoggerFactory } from '../../logger/loggerFactory';

/**
 * Base abstract class for platform-specific gift card service implementations.
 */
export abstract class BaseGiftCardService implements GiftCardServiceInterface {
  protected initialized = false;
  protected logger = LoggerFactory.getInstance().createLogger('BaseGiftCardService');

  abstract initialize(): Promise<boolean>;

  isInitialized(): boolean {
    return this.initialized;
  }

  abstract checkBalance(code: string): Promise<GiftCardInfo>;

  abstract redeemGiftCard(code: string, amount: number): Promise<GiftCardRedemptionResult>;

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }
}
