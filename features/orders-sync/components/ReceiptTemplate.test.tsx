import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import ReceiptTemplate from './ReceiptTemplate';

describe('ReceiptTemplate', () => {
  it('formats line totals using cent-accurate money math and renders header/footer', async () => {
    const order = {
      id: 'ord-12345678',
      items: [{ id: '1', productId: 'p1', name: 'Pastry', price: 2.99, quantity: 3 }],
      subtotal: 8.97,
      tax: 1.79,
      total: 10.76,
      discountAmount: 0,
      paymentMethod: 'cash' as const,
      cashierName: 'Alice',
      customerName: 'Bob',
      status: 'paid' as const,
      syncStatus: 'synced' as const,
      createdAt: new Date(1700000000000),
      updatedAt: new Date(1700000000000),
    };

    const tree = await renderUi(<ReceiptTemplate order={order} currencySymbol="£" businessName="Corner Bakery" />);
    expect(hasText(tree, 'Corner Bakery')).toBe(true);
    expect(hasText(tree, 'Pastry')).toBe(true);
    expect(hasText(tree, '£8.97')).toBe(true);
    expect(hasText(tree, '£10.76')).toBe(true);
  });
});
