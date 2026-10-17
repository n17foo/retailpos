import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useUnifiedProducts, useProductsForDisplay } from './useProducts';
import { ECommercePlatform } from '../../../shared/utils/platforms';

jest.mock('../../platform-clients/hooks/useActivePlatform', () => ({
  useActivePlatform: () => ({ platform: ECommercePlatform.OFFLINE, isResolved: true }),
}));

jest.mock('../../multi-register/services/InstoreApiConfig', () => ({
  instoreApiConfig: { isClient: false },
}));

jest.mock('../../multi-register/services/sync/SyncEventBus', () => ({
  syncEventBus: { on: jest.fn(() => jest.fn()) },
}));

const mockGetProducts = jest.fn();

jest.mock('../services/product/ProductServiceFactory', () => ({
  ProductServiceFactory: {
    getInstance: () => ({
      getService: () => ({
        getProducts: mockGetProducts,
      }),
    }),
  },
}));

describe('useUnifiedProducts & useProductsForDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProducts.mockResolvedValue({
      products: [{ id: 'p1', title: 'Latte', price: 3.5, inventoryQuantity: 5 }],
      pagination: { currentPage: 1, totalPages: 2, totalItems: 2, nextCursor: 'cur-2' },
    });
  });

  it('fetches products, maps to display products, and supports pagination', async () => {
    let latestUnified: ReturnType<typeof useUnifiedProducts> | null = null;
    let latestDisplay: ReturnType<typeof useProductsForDisplay> | null = null;

    function Harness() {
      latestUnified = useUnifiedProducts(ECommercePlatform.OFFLINE);
      latestDisplay = useProductsForDisplay(ECommercePlatform.OFFLINE, null);
      return null;
    }

    await act(async () => {
      createRoot().render(React.createElement(Harness));
    });

    expect(latestUnified!.isLoading).toBe(false);
    expect(latestUnified!.products).toHaveLength(1);
    expect(latestUnified!.hasMore).toBe(true);
    expect(latestDisplay!.products).toHaveLength(1);
    expect(latestDisplay!.products[0].name).toBe('Latte');
  });
});
