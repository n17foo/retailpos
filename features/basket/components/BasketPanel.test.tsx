import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { BasketPanel } from './BasketPanel';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

jest.mock('../../platform-clients/services/config/POSConfigService', () => ({
  posConfig: { values: { saleNoteChips: ['No Ice'] } },
}));

const mockBasketItems = [{ id: 'line-1', productId: 'p1', name: 'Iced Latte', price: 2.99, quantity: 3 }];

jest.mock('../contexts/BasketStateProvider', () => ({
  useBasketState: () => ({
    isLoading: false,
    basket: { id: 'b1', subtotal: 8.97, tax: 1.79, total: 10.76 },
    basketItems: mockBasketItems,
  }),
}));

const mockIncrementQuantity = jest.fn();
jest.mock('../contexts/BasketActionsProvider', () => ({
  useBasketActions: () => ({
    incrementQuantity: mockIncrementQuantity,
    decrementQuantity: jest.fn(),
    removeFromBasket: jest.fn(),
    setCustomer: jest.fn(),
    setNote: jest.fn(),
    setLineProperties: jest.fn(),
    applyDiscount: jest.fn(),
  }),
}));

jest.mock('../../checkout/contexts/CheckoutProvider', () => ({
  useCheckoutContext: () => ({
    unsyncedOrdersCount: 0,
    syncAllPendingOrders: jest.fn(),
  }),
}));

const mockOpenTender = jest.fn();
jest.mock('../../checkout/contexts/SaleProvider', () => ({
  useSale: () => ({
    blockers: [],
    blockingBlockers: [],
    saleState: 'building',
    getAvailableForItem: () => 10,
    openTender: mockOpenTender,
    loyalty: {
      loyaltyBalance: null,
      storeCreditDollars: 0,
      activeRedemption: null,
      isLoading: false,
      redeemLoyalty: jest.fn(),
      redeemStoreCredit: jest.fn(),
      reverseActiveRedemption: jest.fn(),
    },
    checkout: {
      currentOrder: null,
      paymentMode: 'tap_to_pay',
      isProcessing: false,
      total: 10.76,
      subtotal: 8.97,
      tax: 1.79,
      error: null,
    },
  }),
}));

describe('BasketPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders basket items with cent-accurate line total and triggers Cash tender', async () => {
    const onTender = jest.fn();
    const tree = await renderUi(<BasketPanel onTender={onTender} />);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
    expect(hasText(tree, '£8.97')).toBe(true);

    await pressByText(tree, 'Cash');
    expect(onTender).toHaveBeenCalledWith('cash');
  });
});
