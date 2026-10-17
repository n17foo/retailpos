import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import ReceiptModal from './ReceiptModal';

describe('ReceiptModal', () => {
  it('renders ReceiptTemplate for order and invokes onPrint / onClose', async () => {
    const onPrint = jest.fn();
    const onClose = jest.fn();
    const order = {
      id: 'ord-87654321',
      items: [{ id: '1', productId: 'p1', name: 'Cortado', price: 3.2, quantity: 2 }],
      subtotal: 6.4,
      tax: 1.28,
      total: 7.68,
      status: 'paid' as const,
      syncStatus: 'synced' as const,
      createdAt: new Date(1700000000000),
      updatedAt: new Date(1700000000000),
    };

    const tree = await renderUi(<ReceiptModal visible order={order} onPrint={onPrint} onClose={onClose} />);
    expect(hasText(tree, 'Order Receipt')).toBe(true);
    expect(hasText(tree, 'Cortado')).toBe(true);

    await pressByText(tree, 'Print Receipt');
    expect(onPrint).toHaveBeenCalledTimes(1);

    await pressByText(tree, 'Close');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
