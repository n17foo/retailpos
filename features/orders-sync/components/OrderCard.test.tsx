import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { OrderCard } from './OrderCard';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

describe('OrderCard', () => {
  it('renders order details and triggers Print, Exchange, and Resync actions', async () => {
    const onResync = jest.fn();
    const onPrintReceipt = jest.fn();
    const onExchange = jest.fn();
    const order = {
      id: 'ord-11223344',
      items: [{ id: '1', productId: 'p1', name: 'Tea', price: 3, quantity: 1 }],
      subtotal: 3,
      tax: 0.6,
      total: 3.6,
      status: 'paid' as const,
      syncStatus: 'failed' as const,
      syncError: 'Timeout',
      createdAt: new Date(1700000000000),
      updatedAt: new Date(1700000000000),
    };

    const tree = await renderUi(
      <OrderCard order={order} isSyncing={false} onResync={onResync} onPrintReceipt={onPrintReceipt} onExchange={onExchange} />
    );
    expect(hasText(tree, 'Order #11223344')).toBe(true);
    expect(hasText(tree, 'Timeout')).toBe(true);

    await pressByText(tree, 'Print');
    expect(onPrintReceipt).toHaveBeenCalledWith(order);

    await pressByText(tree, 'Exchange');
    expect(onExchange).toHaveBeenCalledWith('ord-11223344');

    await pressByText(tree, 'Resync');
    expect(onResync).toHaveBeenCalledWith('ord-11223344');
  });
});
