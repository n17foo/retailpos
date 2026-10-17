import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { CategoryBar } from './CategoryBar';

const mockSelect = jest.fn();
jest.mock('../contexts/CategoryProvider', () => ({
  useCategoryContext: () => ({
    categories: [
      { id: 'c1', name: 'Drinks' },
      { id: 'c2', name: 'Espresso', parentId: 'c1' },
    ],
    isLoading: false,
    rootCategories: [{ id: 'c1', name: 'Drinks' }],
    subRow: { parentId: 'c1', parentName: 'Drinks', drilled: false, items: [{ id: 'c2', name: 'Espresso', parentId: 'c1' }] },
    selectedRootId: 'c1',
    selectedSubId: null,
    select: mockSelect,
    goUp: jest.fn(),
  }),
}));

describe('CategoryBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders root categories and sub-categories and calls select on tap', async () => {
    const tree = await renderUi(<CategoryBar mode="strips" />);
    expect(hasText(tree, 'All')).toBe(true);
    expect(hasText(tree, 'Drinks')).toBe(true);
    expect(hasText(tree, 'Espresso')).toBe(true);

    await pressByText(tree, 'Espresso');
    expect(mockSelect).toHaveBeenCalledWith('c2');
  });
});
