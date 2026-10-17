import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useSaleCatalog } from './useSaleCatalog';
import { ECommercePlatform } from '../../../shared/utils/platforms';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('../../platform-clients/hooks/useActivePlatform', () => ({
  useActivePlatform: () => ({ platform: ECommercePlatform.OFFLINE, isResolved: true }),
}));

jest.mock('../contexts/CategoryProvider', () => ({
  useCategoryContext: () => ({ categories: [], effectiveCategoryId: null }),
}));

const sampleDisplayProduct = {
  id: 'p1',
  name: 'Mocha',
  price: 4,
  image: 'https://img.test/1.png',
  isEcommerceProduct: false,
  sellable: true,
  stock: 10,
  sku: 'MOCHA-1',
};

jest.mock('./useProducts', () => ({
  useProductsForDisplay: () => ({
    products: [sampleDisplayProduct],
    isLoading: false,
    error: null,
    hasMore: false,
    loadMore: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const mockSearch = jest.fn();
jest.mock('../../../shared/hooks/useSearch', () => ({
  useSearch: () => ({
    search: mockSearch,
    searchResults: {
      localResults: [{ id: 'p1', name: 'Mocha', price: 4, sku: 'MOCHA-1' }],
      ecommerceResults: [],
    },
    isLoading: false,
    isInitialized: true,
  }),
}));

const mockAddUnit = jest.fn().mockResolvedValue(true);
jest.mock('../../basket/hooks/useAddToBasket', () => ({
  useAddToBasket: () => mockAddUnit,
  getAvailability: () => ({ sellable: true, available: 10 }),
}));

jest.mock('../../platform-clients/services/config/POSConfigService', () => ({
  posConfig: { values: { saleDensity: 'auto' } },
}));

jest.mock('../../../shared/services/notifications/NotificationService', () => ({
  notificationService: { notify: jest.fn() },
}));

describe('useSaleCatalog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes displayProducts, adaptive tileDensity, and adds exact SKU on submitSearch', async () => {
    let latest: ReturnType<typeof useSaleCatalog> | null = null;
    function Harness() {
      latest = useSaleCatalog();
      return null;
    }

    await act(async () => {
      createRoot().render(React.createElement(Harness));
    });

    expect(latest!.displayProducts).toHaveLength(1);
    expect(latest!.tileDensity).toBe('large');

    act(() => {
      latest!.setSearchQuery('MOCHA-1');
    });

    let outcome: 'added' | 'browse' | 'idle' = 'idle';
    await act(async () => {
      outcome = await latest!.submitSearch();
    });

    expect(outcome).toBe('added');
    expect(mockAddUnit).toHaveBeenCalledWith(sampleDisplayProduct, undefined);
    expect(latest!.searchQuery).toBe('');
  });
});
