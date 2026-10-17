import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import InventoryFilterTabs from './InventoryFilterTabs';

describe('InventoryFilterTabs', () => {
  it('computes All, Low Stock, and Out of Stock counts and switches filter on tap', async () => {
    const onFilterChange = jest.fn();
    const items = [
      { productId: '1', name: 'A', quantity: 20 },
      { productId: '2', name: 'B', quantity: 4 },
      { productId: '3', name: 'C', quantity: 0 },
    ];
    const tree = await renderUi(<InventoryFilterTabs filter="all" items={items} onFilterChange={onFilterChange} />);
    expect(hasText(tree, 'All (3)')).toBe(true);
    expect(hasText(tree, 'Low Stock (1)')).toBe(true);
    expect(hasText(tree, 'Out of Stock (1)')).toBe(true);

    await pressByText(tree, 'Low Stock (1)');
    expect(onFilterChange).toHaveBeenCalledWith('low');
  });
});
