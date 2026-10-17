/**
 * useLoyaltyBasket
 *
 * Manages loyalty and store credit redemption state within the basket.
 * Tracks active redemption transaction IDs so they can be reversed
 * if the customer is detached or the basket is cleared.
 */

import { useState, useCallback } from 'react';
import { loyaltyService } from '../../customers/services/loyalty/LoyaltyService';
import { storeCreditService } from '../../customers/services/customer/StoreCreditService';
import { LoyaltyBalance } from '../../customers/services/loyalty/LoyaltyService';

export interface ActiveRedemption {
  type: 'loyalty' | 'store_credit';
  transactionId: string;
  discountDollars: number;
}

export function useLoyaltyBasket(customerEmail: string | undefined, orderId: string | undefined) {
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [storeCreditDollars, setStoreCreditDollars] = useState(0);
  const [activeRedemption, setActiveRedemption] = useState<ActiveRedemption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(async () => {
    if (!customerEmail) {
      setLoyaltyBalance(null);
      setStoreCreditDollars(0);
      return;
    }
    try {
      const [lb, sc] = await Promise.all([loyaltyService.getBalance(customerEmail), storeCreditService.getBalanceDollars(customerEmail)]);
      setLoyaltyBalance(lb);
      setStoreCreditDollars(sc);
    } catch {
      // Non-blocking
    }
  }, [customerEmail]);

  const redeemLoyalty = useCallback(
    async (points: number): Promise<number> => {
      if (!customerEmail || !orderId) throw new Error('No customer or order');
      setIsLoading(true);
      setError(null);
      try {
        const result = await loyaltyService.redeemPoints(customerEmail, orderId, points);
        setActiveRedemption({ type: 'loyalty', transactionId: result.transactionId, discountDollars: result.discountDollars });
        await loadBalances();
        return result.discountDollars;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Redemption failed');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [customerEmail, orderId, loadBalances]
  );

  const redeemStoreCredit = useCallback(
    async (amountDollars: number): Promise<number> => {
      if (!customerEmail || !orderId) throw new Error('No customer or order');
      setIsLoading(true);
      setError(null);
      try {
        const amountCents = Math.round(amountDollars * 100);
        const result = await storeCreditService.redeem(customerEmail, orderId, amountCents);
        setActiveRedemption({ type: 'store_credit', transactionId: result.entryId, discountDollars: result.discountDollars });
        await loadBalances();
        return result.discountDollars;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Redemption failed');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [customerEmail, orderId, loadBalances]
  );

  const reverseActiveRedemption = useCallback(async () => {
    if (!activeRedemption) return;
    try {
      if (activeRedemption.type === 'loyalty') {
        await loyaltyService.reverseRedemption(activeRedemption.transactionId);
      } else {
        await storeCreditService.reverseRedemption(activeRedemption.transactionId);
      }
      setActiveRedemption(null);
      await loadBalances();
    } catch {
      // Logged inside the service
    }
  }, [activeRedemption, loadBalances]);

  return {
    loyaltyBalance,
    storeCreditDollars,
    activeRedemption,
    isLoading,
    error,
    loadBalances,
    redeemLoyalty,
    redeemStoreCredit,
    reverseActiveRedemption,
  };
}
