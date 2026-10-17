import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import InventoryItemCard from './InventoryItemCard';

describe('InventoryItemCard', () => {
  it('renders item stock badge, reorder alert, and triggers quick adjustment & Create PO', async () => {
    const onAdjustQuantity = jest.fn();
    const onCreatePO = jest.fn();
    const tree = await renderUi(
      <InventoryItemCard
        item={{ productId: 'p1', name: 'Filter Coffee', sku: 'FC-1', quantity: 3, reorderPoint: 5, reorderQty: 20 }}
        isEditing={false}
        editQuantity=""
        inventoryLoading={false}
        onEditQuantityChange={jest.fn()}
        onStartEdit={jest.fn()}
        onCancelEdit={jest.fn()}
        onSaveQuantity={jest.fn()}
        onAdjustQuantity={onAdjustQuantity}
        onCreatePO={onCreatePO}
      />
    );
    expect(hasText(tree, 'Filter Coffee')).toBe(true);
    expect(hasText(tree, '3 in stock')).toBe(true);

    await pressByText(tree, '+');
    expect(onAdjustQuantity).toHaveBeenCalledWith('p1', 1, undefined);

    await pressByText(tree, 'Create PO');
    expect(onCreatePO).toHaveBeenCalledWith('p1', undefined, 20, undefined);
  });
});
