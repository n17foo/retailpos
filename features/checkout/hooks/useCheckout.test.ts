import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useCheckout } from './useCheckout';
import { useBasketState } from '../../basket/contexts/BasketStateProvider';
import { useCheckoutContext } from '../contexts/CheckoutProvider';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

jest.mock('../../payments/hooks/usePayment', () => ({
  usePayment: () => ({
    processPayment: jest.fn().mockResolvedValue({ success: true, transactionId: 'tx-1' }),
    isTerminalConnected: jest.fn(() => true),
    getPaymentMode: jest.fn(() => 'tap_to_pay'),
    getCurrentProvider: jest.fn(() => 'stripe_nfc'),
  }),
}));

jest.mock('../../authentication/hooks/useManagerApproval', () => ({
  useManagerApproval: () => ({ requestApproval: jest.fn().mockResolvedValue(true) }),
}));

jest.mock('../../basket/contexts/BasketStateProvider', () => ({
  useBasketState: jest.fn(),
}));

jest.mock('../contexts/CheckoutProvider', () => ({
  useCheckoutContext: jest.fn(),
}));

jest.mock('../../platform-clients/services/config/POSConfigService', () => ({
  posConfig: { values: { highValueThreshold: 0 } },
}));

jest.mock('../../hardware/services/drawer/CashDrawerServiceFactory', () => ({
  cashDrawerServiceFactory: { getService: () => ({ driverType: 'none', open: jest.fn() }) },
}));

jest.mock('../../hardware/services/printer/PrinterServiceFactory', () => ({
  PrinterServiceFactory: { getInstance: () => ({ isConnectedToPrinter: () => false }) },
}));

jest.mock('../../hardware/services/display/CustomerDisplayServiceFactory', () => ({
  customerDisplayServiceFactory: { getService: () => ({ updateState: jest.fn() }) },
}));

const mockStartCheckout = jest.fn();
const mockCancelDraftOrder = jest.fn();

describe('useCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useBasketState as jest.Mock).mockReturnValue({
      basketItems: [{ id: 'i1', productId: 'p1', name: 'Tea', price: 3, quantity: 1 }],
      total: 3.6,
      subtotal: 3,
      tax: 0.6,
      itemCount: 1,
      basket: { id: 'b1' },
    });
    (useCheckoutContext as jest.Mock).mockReturnValue({
      currentOrder: null,
      startCheckout: mockStartCheckout,
      markPaymentProcessing: jest.fn(),
      revertToDraft: jest.fn(),
      completePayment: jest.fn(),
      cancelOrder: jest.fn(),
      cancelDraftOrder: mockCancelDraftOrder,
    });
  });

  it('opens checkout modal and creates draft order on handleStartCheckout', async () => {
    let latest: ReturnType<typeof useCheckout> | null = null;
    function Harness() {
      latest = useCheckout();
      return null;
    }

    act(() => {
      createRoot().render(React.createElement(Harness));
    });

    await act(async () => {
      await latest!.handleStartCheckout('cash');
    });

    expect(latest!.checkoutVisible).toBe(true);
    expect(latest!.initialTender).toBe('cash');
    expect(mockStartCheckout).toHaveBeenCalledTimes(1);
  });

  it('reuses existing draft order without creating a duplicate draft', async () => {
    (useCheckoutContext as jest.Mock).mockReturnValue({
      currentOrder: { id: 'ord-draft', status: 'draft', total: 3.6, subtotal: 3, tax: 0.6 },
      startCheckout: mockStartCheckout,
      markPaymentProcessing: jest.fn(),
      revertToDraft: jest.fn(),
      completePayment: jest.fn(),
      cancelOrder: jest.fn(),
      cancelDraftOrder: mockCancelDraftOrder,
    });

    let latest: ReturnType<typeof useCheckout> | null = null;
    function Harness() {
      latest = useCheckout();
      return null;
    }

    act(() => {
      createRoot().render(React.createElement(Harness));
    });

    await act(async () => {
      await latest!.handleStartCheckout('card');
    });

    expect(latest!.checkoutVisible).toBe(true);
    expect(mockStartCheckout).not.toHaveBeenCalled();

    await act(async () => {
      await latest!.handleCancelCheckout();
    });
    expect(mockCancelDraftOrder).toHaveBeenCalledTimes(1);
  });
});
