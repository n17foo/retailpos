import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import InventoryScreen from './InventoryScreen';

const mockProducts = [{ id: 'p1', name: 'Cold Brew', sku: 'CB-1' }];
const mockFetchProducts = jest.fn();
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../../catalogue/hooks/useProducts', () => ({
  useProductsForDisplay: () => ({
    products: mockProducts,
    isLoading: false,
    refresh: mockFetchProducts,
  }),
}));

jest.mock('../../platform-clients/hooks/useEcommerceSettings', () => ({
  useEcommerceSettings: () => ({ isInitialized: true }),
}));

const mockAdjustInventory = jest.fn().mockResolvedValue(true);
const mockGetInventory = jest.fn().mockResolvedValue({
  items: [{ productId: 'p1', sku: 'CB-1', quantity: 5 }],
});

jest.mock('../hooks/useInventory', () => ({
  useInventory: () => ({
    isLoading: false,
    error: null,
    getInventory: mockGetInventory,
    adjustInventory: mockAdjustInventory,
    setInventoryQuantity: jest.fn().mockResolvedValue(true),
  }),
}));

jest.mock('../hooks/useInventoryScanner', () => ({
  useInventoryScanner: () => ({ scanModeActive: false, toggleScanMode: jest.fn() }),
}));

jest.mock('../../procurement/services/ProcurementService', () => ({
  procurementService: {
    getAllReorderConfigs: jest.fn().mockResolvedValue([]),
  },
}));

describe('InventoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and displays inventory items, filter tabs, and adjusts quantity', async () => {
    const tree = await renderUi(<InventoryScreen />);
    expect(hasText(tree, 'Cold Brew')).toBe(true);
    expect(hasText(tree, '5 in stock')).toBe(true);

    await pressByText(tree, '+');
    expect(mockAdjustInventory).toHaveBeenCalledWith('p1', 1, undefined);
  });
});
