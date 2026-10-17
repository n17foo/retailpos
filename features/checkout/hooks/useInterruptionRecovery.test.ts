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

const mockClearBasket = jest.fn();
const mockCancelOrder = jest.fn();
const mockSyncAllPendingOrders = jest.fn();

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
});
