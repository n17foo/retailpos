/**
 * CheckoutProvider
 *
 * Provides checkout state and actions to the application.
 * Wraps CheckoutService and exposes order state, sync status, and checkout actions.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { getServiceContainer } from '../services/basket/BasketServiceFactory';
import type { LocalOrder, CheckoutResult, LocalOrderStatus, PaymentLine } from '../services/order/order';
import type { ECommercePlatform } from '../utils/platforms';
import { useAuthContext } from './AuthProvider';

interface CheckoutContextValue {
  currentOrder: LocalOrder | null;
  unsyncedOrdersCount: number;
  isProcessing: boolean;
  isSyncing: boolean;
  startCheckout: (platform?: ECommercePlatform) => Promise<LocalOrder | null>;
  markPaymentProcessing: (orderId: string) => Promise<void>;
  /** Return a 'processing' order to 'draft' so a failed payment can be retried */
  revertToDraft: (orderId: string) => Promise<void>;
  completePayment: (
    orderId: string,
    paymentMethod: string,
    transactionId?: string,
    paymentLines?: PaymentLine[]
  ) => Promise<CheckoutResult>;
  cancelOrder: (orderId: string) => Promise<void>;
  cancelDraftOrder: () => Promise<void>;
  syncAllPendingOrders: () => Promise<void>;
  // Additional methods for OrderHistory
  getLocalOrders: (status?: LocalOrderStatus) => Promise<LocalOrder[]>;
  syncOrderToPlatform: (orderId: string) => Promise<CheckoutResult>;
  getSyncQueueStatus: () => Promise<{ pending: number; failed: number }>;
}

const CheckoutContext = createContext<CheckoutContextValue | undefined>(undefined);

export function useCheckoutContext() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckoutContext must be used within CheckoutProvider');
  }
  return context;
}

interface CheckoutProviderProps {
  children: ReactNode;
}

export const CheckoutProvider: React.FC<CheckoutProviderProps> = ({ children }) => {
  const { user } = useAuthContext();
  const [currentOrder, setCurrentOrder] = useState<LocalOrder | null>(null);
  const [unsyncedOrdersCount, setUnsyncedOrdersCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load unsynced orders count on mount
  useEffect(() => {
    const loadUnsyncedCount = async () => {
      try {
        const { checkoutService } = await getServiceContainer();
        const unsyncedOrders = await checkoutService.getUnsyncedOrders();
        setUnsyncedOrdersCount(unsyncedOrders.length);
      } catch {
        // Silently fail - unsynced count will remain 0
      }
    };
    loadUnsyncedCount();
  }, []);

  const startCheckout = useCallback(
    async (platform?: ECommercePlatform) => {
      const { checkoutService } = await getServiceContainer();
      const order = await checkoutService.startCheckout(platform, user?.id, user?.username);
      setCurrentOrder(order);
      return order;
    },
    [user]
  );

  const markPaymentProcessing = useCallback(async (orderId: string) => {
    setIsProcessing(true);
    try {
      const { checkoutService } = await getServiceContainer();
      const order = await checkoutService.markPaymentProcessing(orderId);
      setCurrentOrder(order);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const completePayment = useCallback(
    async (orderId: string, paymentMethod: string, transactionId?: string, paymentLines?: PaymentLine[]) => {
      setIsProcessing(true);
      try {
        const { checkoutService } = await getServiceContainer();
        const result = await checkoutService.completePayment(orderId, paymentMethod, transactionId, paymentLines);
        if (result.success) {
          setCurrentOrder(null);
          // Refresh unsynced count
          const unsyncedOrders = await checkoutService.getUnsyncedOrders();
          setUnsyncedOrdersCount(unsyncedOrders.length);
        }
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const revertToDraft = useCallback(async (orderId: string) => {
    const { checkoutService } = await getServiceContainer();
    const order = await checkoutService.revertToDraft(orderId);
    setCurrentOrder(order);
  }, []);

  const cancelOrder = useCallback(async (orderId: string) => {
    const { checkoutService } = await getServiceContainer();
    await checkoutService.cancelOrder(orderId);
    setCurrentOrder(null);
  }, []);

  const cancelDraftOrder = useCallback(async () => {
    if (!currentOrder) return;
    const { checkoutService } = await getServiceContainer();
    await checkoutService.cancelDraftOrder(currentOrder.id, currentOrder.platform, currentOrder.platformOrderId);
    setCurrentOrder(null);
  }, [currentOrder]);

  const syncAllPendingOrders = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { checkoutService, orderSyncService } = await getServiceContainer();
      const unsyncedOrders = await checkoutService.getUnsyncedOrders();

      for (const order of unsyncedOrders) {
        try {
          await orderSyncService.syncOrderToPlatform(order.id);
        } catch {
          // Continue syncing other orders even if one fails
        }
      }

      // Refresh unsynced count
      const remainingUnsynced = await checkoutService.getUnsyncedOrders();
      setUnsyncedOrdersCount(remainingUnsynced.length);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Additional methods for OrderHistory
  const getLocalOrders = useCallback(async (status?: LocalOrderStatus) => {
    try {
      const { checkoutService } = await getServiceContainer();
      return await checkoutService.getLocalOrders(status);
    } catch {
      // Return empty array on error
      return [];
    }
  }, []);

  const syncOrderToPlatform = useCallback(async (orderId: string) => {
    try {
      const { orderSyncService } = await getServiceContainer();
      const result = await orderSyncService.syncOrderToPlatform(orderId);

      // Refresh unsynced count
      const { checkoutService } = await getServiceContainer();
      const unsyncedOrders = await checkoutService.getUnsyncedOrders();
      setUnsyncedOrdersCount(unsyncedOrders.length);

      return result;
    } catch (error) {
      // Return failure result instead of throwing
      return { success: false, orderId, error: (error as Error).message };
    }
  }, []);

  const getSyncQueueStatus = useCallback(async () => {
    try {
      const { checkoutService } = await getServiceContainer();
      const unsyncedOrders = await checkoutService.getUnsyncedOrders();
      const failed = unsyncedOrders.filter(o => o.syncStatus === 'failed').length;
      const pending = unsyncedOrders.filter(o => o.syncStatus === 'pending').length;
      return { pending, failed };
    } catch {
      // Return zeros on error
      return { pending: 0, failed: 0 };
    }
  }, []);

  const value: CheckoutContextValue = {
    currentOrder,
    unsyncedOrdersCount,
    isProcessing,
    isSyncing,
    startCheckout,
    markPaymentProcessing,
    revertToDraft,
    completePayment,
    cancelOrder,
    cancelDraftOrder,
    syncAllPendingOrders,
    getLocalOrders,
    syncOrderToPlatform,
    getSyncQueueStatus,
  };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
};
