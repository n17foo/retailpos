import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import ProductManagementTab from './ProductManagementTab';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

const mockProducts = [
  {
    id: 'p1',
    title: 'blueberry Muffin',
    productType: 'Bakery',
    variants: [{ id: 'v1', title: 'Default', price: 2.8, sku: 'BM-1', inventoryQuantity: 12 }],
  },
];
const mockCategories = [{ id: 'c1', name: 'Bakery' }];

jest.mock('../../catalogue/hooks/useOfflineProducts', () => ({
  useOfflineProducts: () => ({
    products: mockProducts,
    isLoading: false,
    error: null,
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
  }),
}));

jest.mock('../../catalogue/hooks/useOfflineCategories', () => ({
  useOfflineCategories: () => ({
    categories: mockCategories,
  }),
}));

describe('ProductManagementTab', () => {
  it('renders offline product list and opens Add Product modal', async () => {
    const tree = await renderUi(<ProductManagementTab />);
    expect(hasText(tree, 'blueberry Muffin')).toBe(true);

    await pressByText(tree, '+ Add Product');
    expect(hasText(tree, 'Add New Product')).toBe(true);
  });
});
