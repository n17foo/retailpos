import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import CategoryManagementTab from './CategoryManagementTab';

const mockCategories = [{ id: 'c1', name: 'Pastries', description: 'Fresh baked' }];

jest.mock('../../catalogue/hooks/useOfflineCategories', () => ({
  useOfflineCategories: () => ({
    categories: mockCategories,
    isLoading: false,
    error: null,
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
  }),
}));

describe('CategoryManagementTab', () => {
  it('renders offline categories and opens Add Category modal', async () => {
    const tree = await renderUi(<CategoryManagementTab />);
    expect(hasText(tree, 'Pastries')).toBe(true);

    await pressByText(tree, '+ Add Category');
    expect(hasText(tree, 'Add New Category')).toBe(true);
  });
});
