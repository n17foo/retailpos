import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useAddToBasket, getAvailability, toBasketProduct } from './useAddToBasket';
import { useBasketState } from '../contexts/BasketStateProvider';
import { useBasketActions } from '../contexts/BasketActionsProvider';
import { notificationService } from '../../../shared/services/notifications/NotificationService';
import type { DisplayProduct } from '../../catalogue/services/product/displayProduct';

jest.mock('../contexts/BasketStateProvider', () => ({
  useBasketState: jest.fn(),
}));

jest.mock('../contexts/BasketActionsProvider', () => ({
  useBasketActions: jest.fn(),
}));

jest.mock('../../../shared/services/notifications/NotificationService', () => ({
  notificationService: {
    notify: jest.fn(),
  },
}));

const mockAddToBasket = jest.fn();

const sampleProduct: DisplayProduct = {
  id: 'p1',
  name: 'Espresso',
  price: 3.5,
  image: null,
  isEcommerceProduct: true,
  sellable: true,
  stock: 2,
};

function mountHook() {
  let latest: ReturnType<typeof useAddToBasket> | null = null;
  function Harness() {
    latest = useAddToBasket();
    return null;
  }
  act(() => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useAddToBasket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useBasketState as jest.Mock).mockReturnValue({ basketItems: [] });
    (useBasketActions as jest.Mock).mockReturnValue({ addToBasket: mockAddToBasket });
  });

  it('adds sellable product within stock limits and maps variant properties', async () => {
    const { get } = mountHook();

    let added = false;
    await act(async () => {
      added = await get()(sampleProduct);
    });

    expect(added).toBe(true);
    expect(mockAddToBasket).toHaveBeenCalledWith(toBasketProduct(sampleProduct), 1);
    expect(getAvailability(sampleProduct)).toEqual({ sellable: true, available: 2 });
  });

  it('blocks adding out-of-stock product and notifies user', async () => {
    const { get } = mountHook();
    const outOfStock: DisplayProduct = { ...sampleProduct, sellable: false, stock: 0 };

    let added = true;
    await act(async () => {
      added = await get()(outOfStock);
    });

    expect(added).toBe(false);
    expect(notificationService.notify).toHaveBeenCalledWith('Out of stock', expect.stringContaining('Espresso'), 'warning');
    expect(mockAddToBasket).not.toHaveBeenCalled();
  });

  it('blocks adding when basket quantity already reached available stock', async () => {
    (useBasketState as jest.Mock).mockReturnValue({
      basketItems: [{ productId: 'p1', variantId: undefined, quantity: 2 }],
    });
    const { get } = mountHook();

    let added = true;
    await act(async () => {
      added = await get()(sampleProduct);
    });

    expect(added).toBe(false);
    expect(notificationService.notify).toHaveBeenCalledWith('Stock limit', expect.stringContaining('Only 2 available'), 'warning');
    expect(mockAddToBasket).not.toHaveBeenCalled();
  });
});
