/**
 * useInterruptionRecovery
 *
 * Detects interrupted operations and provides resume flows.
 * Implements Sales UX spec §2.6 (Interruption Detection & Resume).
 */

import { useState, useEffect, useCallback } from 'react';
import { useBasketState } from '../../basket/contexts/BasketStateProvider';
import { useBasketActions } from '../../basket/contexts/BasketActionsProvider';
import { useCheckoutContext } from '../contexts/CheckoutProvider';
import type { InterruptionType } from '../components/InterruptionBanner';

export interface InterruptionState {
  type: InterruptionType;
  isChecking: boolean;
  orderId?: string;
  itemCount?: number;
  total?: number;
}

export function useInterruptionRecovery() {
  const { basketItems, total } = useBasketState();
  const { clearBasket } = useBasketActions();
  const { unsyncedOrdersCount, currentOrder, syncAllPendingOrders, cancelOrder } = useCheckoutContext();
  const [interruptionState, setInterruptionState] = useState<InterruptionState>({
    type: 'none',
    isChecking: true,
  });
  const [dismissed, setDismissed] = useState(false);

  // Check for interruptions on mount
  useEffect(() => {
    const checkInterruptions = async () => {
      // Priority order: interrupted payment > interrupted checkout > draft sale > unsynced orders

      // 1. Interrupted payment (order in 'processing' state)
      if (currentOrder && currentOrder.status === 'processing') {
        setInterruptionState({
          type: 'interrupted-payment',
          isChecking: false,
          orderId: currentOrder.id,
          itemCount: currentOrder.items.length,
          total: currentOrder.total,
        });
        return;
      }

      // 2. Interrupted checkout (order in 'draft' state)
      if (currentOrder && currentOrder.status === 'draft') {
        setInterruptionState({
          type: 'interrupted-checkout',
          isChecking: false,
          orderId: currentOrder.id,
          itemCount: currentOrder.items.length,
          total: currentOrder.total,
        });
        return;
      }

      // 3. Draft sale (basket has items on app open)
      if (basketItems.length > 0 && !currentOrder) {
        setInterruptionState({
          type: 'draft-sale',
          isChecking: false,
          itemCount: basketItems.length,
          total,
        });
        return;
      }

      // 4. Unsynced orders
      if (unsyncedOrdersCount > 0) {
        setInterruptionState({
          type: 'unsynced',
          isChecking: false,
        });
        return;
      }

      // No interruptions
      setInterruptionState({
        type: 'none',
        isChecking: false,
      });
    };

    checkInterruptions();
  }, [basketItems.length, total, currentOrder, unsyncedOrdersCount]);

  // Resume draft sale (just dismiss banner, basket is already intact)
  const resumeDraftSale = useCallback(() => {
    setDismissed(true);
  }, []);

  // Resume checkout (open checkout modal with existing order)
  const resumeCheckout = useCallback(() => {
    // This will be handled by the parent component
    // by checking interruptionState.type === 'interrupted-checkout'
    setDismissed(true);
  }, []);

  // Recover payment (show recovery modal)
  const recoverPayment = useCallback(() => {
    // This will be handled by the parent component
    // by checking interruptionState.type === 'interrupted-payment'
    setDismissed(true);
  }, []);

  // Clear basket and dismiss
  const clearAndDismiss = useCallback(async () => {
    await clearBasket();
    setDismissed(true);
  }, [clearBasket]);

  // Cancel order and dismiss
  const cancelAndDismiss = useCallback(async () => {
    if (interruptionState.orderId) {
      await cancelOrder(interruptionState.orderId);
    }
    setDismissed(true);
  }, [interruptionState.orderId, cancelOrder]);

  // Retry sync
  const retrySync = useCallback(async () => {
    await syncAllPendingOrders();
    setDismissed(true);
  }, [syncAllPendingOrders]);

  // Dismiss banner
  const dismissBanner = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    interruptionState: dismissed ? { ...interruptionState, type: 'none' as const } : interruptionState,
    resumeDraftSale,
    resumeCheckout,
    recoverPayment,
    clearAndDismiss,
    cancelAndDismiss,
    retrySync,
    dismissBanner,
  };
}
