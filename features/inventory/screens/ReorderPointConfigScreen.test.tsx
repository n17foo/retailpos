import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import ReorderPointConfigScreen from './ReorderPointConfigScreen';

const mockProducts = [{ id: 'p1', name: 'Oat Milk', sku: 'OM-1' }];

jest.mock('../../catalogue/hooks/useProducts', () => ({
  useProductsForDisplay: () => ({
    products: mockProducts,
  }),
}));

jest.mock('../../procurement/services/VendorService', () => ({
  vendorService: {
    findAll: jest.fn().mockResolvedValue([{ id: 'v1', name: 'Dairy Co' }]),
  },
}));

jest.mock('../../procurement/services/ProcurementService', () => ({
  procurementService: {
    getAllReorderConfigs: jest
      .fn()
      .mockResolvedValue([{ product_id: 'p1', variant_id: null, reorder_point: 10, reorder_qty: 24, default_vendor_id: 'v1' }]),
    setReorderPoint: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ReorderPointConfigScreen', () => {
  it('loads and displays product reorder point configurations and vendor name', async () => {
    const tree = await renderUi(<ReorderPointConfigScreen />);
    expect(hasText(tree, 'Reorder Point Configuration')).toBe(true);
    expect(hasText(tree, 'Oat Milk')).toBe(true);
    expect(hasText(tree, 'Dairy Co')).toBe(true);
  });
});
