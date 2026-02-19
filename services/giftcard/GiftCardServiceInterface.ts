/**
 * Information about a gift card retrieved from the platform.
 */
export interface GiftCardInfo {
  code: string;
  balance: number;
  currency: string;
  status: 'active' | 'disabled' | 'expired' | 'not_found';
  expiresAt?: Date;
  lastUsedAt?: Date;
}

/**
 * Result of redeeming a gift card.
 */
export interface GiftCardRedemptionResult {
  success: boolean;
  /** Amount actually deducted from the gift card */
  amountDeducted: number;
  /** Remaining balance after redemption */
  remainingBalance: number;
  /** Transaction/reference ID from the platform */
  transactionId?: string;
  error?: string;
}

/**
 * Interface for gift card operations.
 * Gift cards are managed on the e-commerce platform.
 * The POS checks balances and redeems them during checkout.
 */
export interface GiftCardServiceInterface {
  /**
   * Initialize the gift card service
   */
  initialize(): Promise<boolean>;

  /**
   * Whether the service is ready
   */
  isInitialized(): boolean;

  /**
   * Check the balance and status of a gift card.
   * @param code The gift card code
   */
  checkBalance(code: string): Promise<GiftCardInfo>;

  /**
   * Redeem (deduct) an amount from a gift card.
   * @param code The gift card code
   * @param amount The amount to deduct
   */
  redeemGiftCard(code: string, amount: number): Promise<GiftCardRedemptionResult>;
}
