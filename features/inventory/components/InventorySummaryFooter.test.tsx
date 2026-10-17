import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import InventorySummaryFooter from './InventorySummaryFooter';

describe('InventorySummaryFooter', () => {
  it('returns null when empty and renders summary counts when populated', async () => {
    const emptyTree = await renderUi(<InventorySummaryFooter items={[]} />);
    expect(emptyTree.toJSON()).toBeNull();

    const tree = await renderUi(
      <InventorySummaryFooter
        items={[
          { productId: '1', name: 'A', quantity: 15 },
          { productId: '2', name: 'B', quantity: 3 },
          { productId: '3', name: 'C', quantity: 0 },
        ]}
      />
    );
    expect(hasText(tree, 'Total Products')).toBe(true);
    expect(hasText(tree, 'Low Stock')).toBe(true);
    expect(hasText(tree, 'Out of Stock')).toBe(true);
  });
});
