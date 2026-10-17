import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useOfflineProducts } from './useOfflineProducts';
import { offlineProductService } from '../services/product/platforms/OfflineProductService';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../services/product/platforms/OfflineProductService', () => ({
  offlineProductService: {
    getProducts: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
    getProductById: jest.fn(),
    clearLocalProducts: jest.fn(),
  },
}));

async function mountHook() {
  let latest: ReturnType<typeof useOfflineProducts> | null = null;
  function Harness() {
    latest = useOfflineProducts();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useOfflineProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (offlineProductService.getProducts as jest.Mock).mockResolvedValue({
      products: [{ id: 'p1', title: 'Croissant', price: 2.5 }],
    });
  });

  it('loads offline products on mount and supports create/delete', async () => {
    (offlineProductService.createProduct as jest.Mock).mockResolvedValue({ id: 'p2', title: 'Bagel', price: 3 });
    (offlineProductService.deleteProduct as jest.Mock).mockResolvedValue(true);

    const { get } = await mountHook();
    expect(get().products).toHaveLength(1);

    await act(async () => {
      const created = await get().createProduct({ title: 'Bagel', price: 3 } as never);
      expect(created.id).toBe('p2');
      const deleted = await get().deleteProduct('p1');
      expect(deleted).toBe(true);
    });

    expect(offlineProductService.createProduct).toHaveBeenCalled();
    expect(offlineProductService.deleteProduct).toHaveBeenCalledWith('p1');
  });
});
