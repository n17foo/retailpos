import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useSaleScreen } from './useSaleScreen';
import { useBasketState } from '../../basket/contexts/BasketStateProvider';
import { useCheckoutContext } from '../contexts/CheckoutProvider';

jest.mock('../../basket/contexts/BasketStateProvider', () => ({
  useBasketState: jest.fn(),
}));

jest.mock('../contexts/CheckoutProvider', () => ({
  useCheckoutContext: jest.fn(),
}));

const mockClearCategory = jest.fn();
jest.mock('../../catalogue/contexts/CategoryProvider', () => ({
  useCategoryContext: () => ({ clear: mockClearCategory }),
}));

const mockClearSearch = jest.fn();
jest.mock('../../catalogue/hooks/useSaleCatalog', () => ({
  useSaleCatalog: () => ({
    products: [],
    catalogPlatform: 'offline',
    currentPlatform: 'offline',
    addProduct: jest.fn(),
    clearSearch: mockClearSearch,
  }),
}));

jest.mock('../../scanning/hooks/useSaleScanner', () => ({
  useSaleScanner: () => ({
    notice: null,
    dismissNotice: jest.fn(),
    isCameraOpen: false,
    openCamera: jest.fn(),
    closeCamera: jest.fn(),
    handleBarCodeScanned: jest.fn(),
    handleScan: jest.fn(),
  }),
}));

const mockHandleStartCheckout = jest.fn();
jest.mock('./useCheckout', () => ({
  useCheckout: () => ({
    currentOrder: null,
    handleStartCheckout: mockHandleStartCheckout,
  }),
}));

jest.mock('../../basket/hooks/useLoyaltyBasket', () => ({
  useLoyaltyBasket: () => ({
    loadBalances: jest.fn(),
  }),
}));

jest.mock('../../hardware/hooks/useCashDrawerStatus', () => ({
  useCashDrawerStatus: () => ({ isOpen: false }),
}));

jest.mock('../../hardware/services/drawer/CashDrawerServiceFactory', () => ({
  cashDrawerServiceFactory: { getService: () => ({ driverType: 'none' }) },
}));

jest.mock('../../platform-clients/services/config/POSConfigService', () => ({
  posConfig: { values: { saleInputMode: 'pointer' } },
}));

describe('useSaleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useBasketState as jest.Mock).mockReturnValue({
      basketItems: [{ id: '1', productId: 'p1', name: 'Item', price: 5, quantity: 1 }],
      basketItemsMap: new Map(),
      itemCount: 1,
      total: 5,
      basket: { id: 'b1', discountCode: 'PROMO10', customerEmail: undefined },
    });
    (useCheckoutContext as jest.Mock).mockReturnValue({
      currentOrder: null,
      unsyncedOrdersCount: 2,
      isProcessing: false,
      syncAllPendingOrders: jest.fn(),
      isSyncing: false,
    });
  });

  it('derives blockers (customer-required & unsynced-orders), saleState, and resetSaleUi', () => {
    let latest: ReturnType<typeof useSaleScreen> | null = null;
    function Harness() {
      latest = useSaleScreen();
      return null;
    }

    act(() => {
      createRoot().render(React.createElement(Harness));
    });

    expect(latest!.blockers.map(b => b.code)).toEqual(['customer-required', 'unsynced-orders']);
    expect(latest!.blockingBlockers.map(b => b.code)).toEqual(['customer-required']);
    expect(latest!.saleState).toBe('needs-attention');

    act(() => {
      latest!.openBasketSheet();
    });
    expect(latest!.isBasketSheetOpen).toBe(true);

    act(() => {
      latest!.resetSaleUi();
    });
    expect(mockClearCategory).toHaveBeenCalled();
    expect(mockClearSearch).toHaveBeenCalled();
    expect(latest!.isBasketSheetOpen).toBe(false);
  });
});
