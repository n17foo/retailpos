import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import SaleScreen from './SaleScreen';
import { getSaleLayout } from '../../../shared/utils/responsive.utils';

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', username: 'Alice', role: 'admin' } }),
}));

jest.mock('../contexts/CheckoutProvider', () => ({
  useCheckoutContext: () => ({ getLocalOrders: jest.fn().mockResolvedValue([]) }),
}));

jest.mock('../../basket/contexts/BasketActionsProvider', () => ({
  useBasketActions: () => ({ setSaleMode: jest.fn() }),
}));

jest.mock('../hooks/useInterruptionRecovery', () => ({
  useInterruptionRecovery: () => ({
    interruptionState: { type: 'none', isChecking: false },
    resumeDraftSale: jest.fn(),
    resumeCheckout: jest.fn(),
    recoverPayment: jest.fn(),
    clearAndDismiss: jest.fn(),
    cancelAndDismiss: jest.fn(),
    retrySync: jest.fn(),
    dismissBanner: jest.fn(),
  }),
}));

jest.mock('../../multi-register/services/InstoreApiConfig', () => ({
  instoreApiConfig: { current: { registerName: 'Till 1' } },
}));

jest.mock('../../platform-clients/services/config/POSConfigService', () => ({
  posConfig: { values: { saleModes: ['counter', 'pickup'] } },
}));

jest.mock('../contexts/SaleProvider', () => ({
  SaleProvider: ({ children }: { children: React.ReactNode }) => children,
  useSale: () => ({
    layout: getSaleLayout(1024, 768),
    inputMode: 'pointer',
    currentPlatform: 'offline',
    displayProducts: [],
    basketItemsMap: {},
    tileDensity: 'large',
    isCatalogLoading: false,
    hasMore: false,
    loadMore: jest.fn(),
    isSearchActive: false,
    searchProducts: [],
    isSearching: false,
    searchQuery: '',
    setSearchQuery: jest.fn(),
    submitSearch: jest.fn(),
    openCamera: jest.fn(),
    closeCamera: jest.fn(),
    isCameraOpen: false,
    handleBarCodeScanned: jest.fn(),
    handleScan: jest.fn(),
    isElectron: false,
    scanNotice: null,
    saleState: 'empty',
    unsyncedOrdersCount: 0,
    isSyncing: false,
    syncAllPendingOrders: jest.fn(),
    isDrawerOpen: false,
    basket: { id: 'b1', saleMode: 'counter' },
    itemCount: 0,
    total: 0,
    isBasketSheetOpen: false,
    openBasketSheet: jest.fn(),
    closeBasketSheet: jest.fn(),
    openTender: jest.fn(),
    loyalty: { loyaltyBalance: null, storeCreditDollars: 0 },
    checkout: {
      checkoutVisible: false,
      currentOrder: null,
      total: 0,
      subtotal: 0,
      tax: 0,
      itemCount: 0,
      handlePayment: jest.fn(),
      handleCancelCheckout: jest.fn(),
      isProcessing: false,
      isDraftPending: false,
      terminalConnected: false,
      paymentMode: 'cash_only',
      splitMode: false,
      paymentLines: [],
      addPaymentLine: jest.fn(),
      removePaymentLine: jest.fn(),
      handleCompleteSplit: jest.fn(),
      splitCashTenderAmount: null,
      confirmSplitCashPayment: jest.fn(),
      initialTender: null,
      error: null,
    },
  }),
}));

jest.mock('../../catalogue/components/CategoryBar', () => ({
  CategoryBar: () => {
    const R = require('react');
    return R.createElement('Text', null, 'MockCategoryBar');
  },
}));

jest.mock('../../basket/components/BasketPanel', () => ({
  BasketPanel: () => {
    const R = require('react');
    return R.createElement('Text', null, 'MockBasketPanel');
  },
}));

jest.mock('../../scanning/components/HidCaptureField', () => ({
  HidCaptureField: () => null,
}));

describe('SaleScreen', () => {
  it('renders TopBar, CategoryBar, ProductGrid, and BasketPanel in split layout', async () => {
    const tree = await renderUi(<SaleScreen username="Alice" />);
    expect(hasText(tree, 'Till 1')).toBe(true);
    expect(hasText(tree, 'Alice')).toBe(true);
    expect(hasText(tree, 'MockCategoryBar')).toBe(true);
    expect(hasText(tree, 'MockBasketPanel')).toBe(true);
  });
});
