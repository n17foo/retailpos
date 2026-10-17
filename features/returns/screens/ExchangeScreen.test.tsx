import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import ExchangeScreen from './ExchangeScreen';
import { mockRouteParams } from '../../../tests/__mocks__/uiMocks';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', username: 'Admin', role: 'admin' } }),
}));

const mockGetReturnableItems = jest.fn().mockResolvedValue([
  {
    orderItemId: 'oi-1',
    productId: 'p1',
    variantId: null,
    name: 'Ceramic Mug',
    price: 10,
    originalQuantity: 2,
    returnedQuantity: 0,
    returnableQuantity: 2,
  },
]);

jest.mock('../services/refunds/RefundService', () => ({
  ReturnService: {
    getInstance: () => ({
      getReturnableItems: mockGetReturnableItems,
    }),
  },
}));

jest.mock('../../basket/services/BasketServiceFactory', () => ({
  BasketServiceFactory: {
    getInstance: () => ({
      getServices: jest.fn().mockResolvedValue({ checkoutService: {} }),
    }),
  },
}));

describe('ExchangeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams.orderId = 'ord-12345678';
  });

  it('loads returnable items for the order, increments return quantity, and advances to Step 2', async () => {
    const tree = await renderUi(<ExchangeScreen />);
    expect(hasText(tree, 'Ceramic Mug')).toBe(true);
    expect(hasText(tree, 'Return credit: £0.00')).toBe(true);

    await pressByText(tree, '+');
    expect(hasText(tree, 'Return credit: £10.00')).toBe(true);

    await pressByText(tree, 'Next: Add New Items');
    expect(hasText(tree, 'New items in exchange')).toBe(true);
  });
});
