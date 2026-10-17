/**
 * useCustomerProfile
 *
 * Loads a local customer profile with purchase history, loyalty balance,
 * and store credit balance. Used by CustomerProfileScreen.
 */

import { useState, useEffect, useCallback } from 'react';
import { localCustomerService, CustomerOrderSummary } from '../services/customer/LocalCustomerService';
import { loyaltyService, LoyaltyBalance } from '../services/loyalty/LoyaltyService';
import { storeCreditService } from '../services/customer/StoreCreditService';
import { LocalCustomer } from '../repositories/LocalCustomerRepository';

export interface CustomerProfileData {
  customer: LocalCustomer | null;
  orderHistory: CustomerOrderSummary[];
  loyaltyBalance: LoyaltyBalance | null;
  storeCreditDollars: number;
  isLoading: boolean;
  error: string | null;
}

export function useCustomerProfile(email: string | null): CustomerProfileData & { reload: () => void } {
  const [customer, setCustomer] = useState<LocalCustomer | null>(null);
  const [orderHistory, setOrderHistory] = useState<CustomerOrderSummary[]>([]);
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [storeCreditDollars, setStoreCreditDollars] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!email) return;
    setIsLoading(true);
    setError(null);
    try {
      const [cust, history, loyalty, creditDollars] = await Promise.all([
        localCustomerService.findByEmail(email),
        localCustomerService.getOrderHistory(email),
        loyaltyService.getBalance(email),
        storeCreditService.getBalanceDollars(email),
      ]);
      setCustomer(cust);
      setOrderHistory(history);
      setLoyaltyBalance(loyalty);
      setStoreCreditDollars(creditDollars);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer profile');
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  useEffect(() => {
    load();
  }, [load]);

  return { customer, orderHistory, loyaltyBalance, storeCreditDollars, isLoading, error, reload: load };
}
