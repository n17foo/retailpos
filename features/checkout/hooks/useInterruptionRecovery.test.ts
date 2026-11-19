import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useInterruptionRecovery } from './useInterruptionRecovery';
import { useBasketState } from '../../basket/contexts/BasketStateProvider';
import { useBasketActions } from '../../basket/contexts/BasketActionsProvider';
import { useCheckoutContext } from '../contexts/CheckoutProvider';

jest.mock('../../basket/contexts/BasketStateProvider', () => ({
  useBasketState: jest.fn(),
}));

jest.mock('../../basket/contexts/BasketActionsProvider', () => ({
  useBasketActions: jest.fn(),
}));

jest.mock('../contexts/CheckoutProvider', () => ({
  useCheckoutContext: jest.fn(),
}));

jest.mock('../../../shared/services/notifications/NotificationService', () => ({
  notificationService: { notify: jest.fn() },
}));

jest.mock('../../payments/services/PaymentService', () => ({
  __esModule: true,
  default: {
    getTransactionStatus: jest.fn(),
    getOpenPaymentForOrder: jest.fn(),
  },
}));

import paymentService from '../../payments/services/PaymentService';
import { notificationService } from '../../../shared/services/notifications/NotificationService';

const mockClearBasket = jest.fn();
const mockCancelOrder = jest.fn();
const mockSyncAllPendingOrders = jest.fn();
const mockRevertToDraft = jest.fn();
const mockCompletePayment = jest.fn();

describe('useInterruptionRecovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useBasketActions as jest.Mock).mockReturnValue({ clearBasket: mockClearBasket });
  });

  it('detects interrupted-checkout when currentOrder is in draft state', async () => {
    (useBasketState as jest.Mock).mockReturnValue({ basketItems: [{ id: '1' }], total: 10 });
    (useCheckoutContext as jest.Mock).mockReturnValue({
      currentOrder: { id: 'ord-1', status: 'draft', items: [{ id: '1' }], total: 10 },
      unsyncedOrdersCount: 0,
      syncAllPendingOrders: mockSyncAllPendingOrders,
      cancelOrder: mockCancelOrder,
    });

    let latest: ReturnType<typeof useInterruptionRecovery> | null = null;
    function Harness() {
      latest = useInterruptionRecovery();
      return null;
    }

    await act(async () => {
      createRoot().render(React.createElement(Harness));
    });

    expect(latest!.interruptionState.type).toBe('interrupted-checkout');
    expect(latest!.interruptionState.orderId).toBe('ord-1');

    await act(async () => {
      await latest!.cancelAndDismiss();
    });

    expect(mockCancelOrder).toHaveBeenCalledWith('ord-1');
    expect(latest!.interruptionState.type).toBe('none');
  });

  it('detects draft-sale when basket has items and no currentOrder exists', async () => {
    (useBasketState as jest.Mock).mockReturnValue({ basketItems: [{ id: '1' }], total: 10 });
    (useCheckoutContext as jest.Mock).mockReturnValue({
      currentOrder: null,
      unsyncedOrdersCount: 0,
      syncAllPendingOrders: mockSyncAllPendingOrders,
      cancelOrder: mockCancelOrder,
    });

    let latest: ReturnType<typeof useInterruptionRecovery> | null = null;
    function Harness() {
      latest = useInterruptionRecovery();
      return null;
    }

    await act(async () => {
      createRoot().render(React.createElement(Harness));
    });

    expect(latest!.interruptionState.type).toBe('draft-sale');

    await act(async () => {
      await latest!.clearAndDismiss();
    });
    expect(mockClearBasket).toHaveBeenCalled();
    expect(latest!.interruptionState.type).toBe('none');
  });

  describe('CHK-01 — interrupted payment recovery', () => {
    const processingOrder = (over: Record<string, unknown> = {}) => ({
      id: 'ord-1',
      status: 'processing',
      items: [{ id: '1' }],
      total: 10,
      ...over,
    });

    async function mount(order: ReturnType<typeof processingOrder>) {
      (useBasketState as jest.Mock).mockReturnValue({ basketItems: [], total: 0 });
      (useCheckoutContext as jest.Mock).mockReturnValue({
        currentOrder: order,
        unsyncedOrdersCount: 0,
        syncAllPendingOrders: mockSyncAllPendingOrders,
        cancelOrder: mockCancelOrder,
        revertToDraft: mockRevertToDraft,
        completePayment: mockCompletePayment,
      });

      let latest: ReturnType<typeof useInterruptionRecovery> | null = null;
      function Harness() {
        latest = useInterruptionRecovery();
        return null;
      }
      await act(async () => {
        createRoot().render(React.createElement(Harness));
      });
      return latest!;
    }

    it('reverts to draft only when the provider confirms no charge exists for the order', async () => {
      const latest = await mount(processingOrder());
      expect(latest.interruptionState.type).toBe('interrupted-payment');

      (paymentService.getOpenPaymentForOrder as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        await latest.recoverPayment();
      });

      expect(mockRevertToDraft).toHaveBeenCalledWith('ord-1');
    });

    it('records the sale when the provider finds an approved intent the order never persisted', async () => {
      const latest = await mount(processingOrder());

      (paymentService.getOpenPaymentForOrder as jest.Mock).mockResolvedValue({
        success: true,
        outcome: 'approved',
        transactionId: 'pi-found',
      });
      mockCompletePayment.mockResolvedValue({ success: true, orderId: 'ord-1' });

      await act(async () => {
        await latest.recoverPayment();
      });

      expect(mockRevertToDraft).not.toHaveBeenCalled();
      expect(mockCompletePayment).toHaveBeenCalledWith('ord-1', 'card', 'pi-found');
    });

    it('keeps the order processing when the provider cannot verify and no evidence exists', async () => {
      const latest = await mount(processingOrder());

      (paymentService.getOpenPaymentForOrder as jest.Mock).mockRejectedValue(new Error('unsupported'));

      await act(async () => {
        await latest.recoverPayment();
      });

      // Missing local evidence is not proof of no charge — fail closed.
      expect(mockRevertToDraft).not.toHaveBeenCalled();
      expect(mockCompletePayment).not.toHaveBeenCalled();
      expect(notificationService.notify).toHaveBeenCalledWith('Payment recovery', expect.stringContaining('could not verify'), 'warning');
    });

    it('keeps the order processing when the stored transaction outcome is still unknown', async () => {
      const latest = await mount(processingOrder({ paymentTransactionId: 'pi-1', paymentMethod: 'card' }));

      (paymentService.getTransactionStatus as jest.Mock).mockResolvedValue({
        success: false,
        outcome: 'unknown',
        transactionId: 'pi-1',
      });

      await act(async () => {
        await latest.recoverPayment();
      });

      expect(mockRevertToDraft).not.toHaveBeenCalled();
      expect(mockCompletePayment).not.toHaveBeenCalled();
      expect(latest.interruptionState.type).toBe('interrupted-payment');
    });

    it('reverts to draft when the stored transaction is confirmed declined', async () => {
      const latest = await mount(processingOrder({ paymentTransactionId: 'pi-1', paymentMethod: 'card' }));

      (paymentService.getTransactionStatus as jest.Mock).mockResolvedValue({
        success: false,
        outcome: 'declined',
        transactionId: 'pi-1',
      });

      await act(async () => {
        await latest.recoverPayment();
      });

      expect(mockRevertToDraft).toHaveBeenCalledWith('ord-1');
    });

    it('completes the sale when the persisted split-tender charge is confirmed', async () => {
      const latest = await mount(
        processingOrder({
          paymentMethod: 'card',
          payments: [{ id: 'l1', method: 'card', amount: 10, transactionId: 'pi-split' }],
        })
      );

      (paymentService.getTransactionStatus as jest.Mock).mockResolvedValue({
        success: true,
        outcome: 'approved',
        transactionId: 'pi-split',
      });
      mockCompletePayment.mockResolvedValue({ success: true, orderId: 'ord-1' });

      await act(async () => {
        await latest.recoverPayment();
      });

      expect(mockCompletePayment).toHaveBeenCalledWith('ord-1', 'card', 'pi-split');
    });
  });
});
