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
import { notificationService } from '../../../shared/services/notifications/NotificationService';
import paymentService from '../../payments/services/PaymentService';
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
  const { unsyncedOrdersCount, currentOrder, syncAllPendingOrders, cancelOrder, revertToDraft, completePayment } = useCheckoutContext();
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

  /**
   * Recover an interrupted payment (spec §2.6). Actually asks the processor
   * for the transaction outcome instead of just dismissing (audit bug 5):
   *  - no transaction recorded → the charge never reached the processor →
   *    safe to return the order to draft.
   *  - processor confirms success → record the sale as paid.
   *  - processor confirms failure → safe to return to draft.
   *  - provider can't verify → keep 'processing' and tell staff to check.
   */
  const recoverPayment = useCallback(async () => {
    const orderId = interruptionState.orderId;
    if (!orderId) {
      setDismissed(true);
      return;
    }

    const order = currentOrder?.id === orderId ? currentOrder : null;
    const transactionId = order?.paymentTransactionId;

    if (!transactionId) {
      // No transaction id — the charge never reached the processor.
      await revertToDraft(orderId);
      notificationService.notify('Payment recovery', 'No charge was recorded — order returned to draft', 'info');
      setDismissed(true);
      return;
    }

    try {
      const status = await paymentService.getTransactionStatus(transactionId);
      if (status.success) {
        // Charge confirmed — finish recording the sale.
        const result = await completePayment(orderId, order?.paymentMethod ?? 'card', transactionId);
        if (result.success) {
          notificationService.notify('Payment recovery', 'Charge confirmed — order recorded as paid', 'success');
          setDismissed(true);
        } else {
          notificationService.notify('Payment recovery', result.error ?? 'Could not record the confirmed charge', 'warning');
        }
      } else {
        // Processor confirms the charge did not happen — safe to retry.
        await revertToDraft(orderId);
        notificationService.notify('Payment recovery', 'Processor reports no completed charge — order returned to draft', 'info');
        setDismissed(true);
      }
    } catch {
      // Provider cannot verify — do NOT dismiss; staff must check the
      // processor before deciding (double-charge risk).
      notificationService.notify(
        'Payment recovery',
        `Could not verify the payment — check the processor for transaction ${transactionId.slice(-8)} before retrying`,
        'warning'
      );
    }
  }, [interruptionState.orderId, currentOrder, revertToDraft, completePayment]);

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
