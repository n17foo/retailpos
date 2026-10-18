import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { BasketSummary } from './BasketSummary';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

const baseProps = {
  unsyncedOrdersCount: 0,
  isSyncing: false,
  onSync: jest.fn(),
  subtotal: 8.97,
  tax: 1.79,
  total: 10.76,
  taxAtCheckout: false,
  error: null,
  currencyCode: 'GBP',
};

describe('BasketSummary', () => {
  it('renders subtotal, tax and total', async () => {
    const tree = await renderUi(<BasketSummary {...baseProps} />);
    expect(hasText(tree, '£8.97')).toBe(true);
    expect(hasText(tree, '£1.79')).toBe(true);
    expect(hasText(tree, '£10.76')).toBe(true);
  });

  it('shows the sync banner and fires onSync', async () => {
    const onSync = jest.fn();
    const tree = await renderUi(<BasketSummary {...baseProps} unsyncedOrdersCount={3} onSync={onSync} />);
    await pressByText(tree, '3 pending sync');
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('labels totals as pre-tax when the platform calculates tax at checkout', async () => {
    const tree = await renderUi(<BasketSummary {...baseProps} taxAtCheckout />);
    expect(hasText(tree, 'basket.taxAtCheckout')).toBe(true);
    expect(hasText(tree, 'basket.totalBeforeTax')).toBe(true);
  });

  it('renders the tender error', async () => {
    const tree = await renderUi(<BasketSummary {...baseProps} error="Card declined" />);
    expect(hasText(tree, 'Card declined')).toBe(true);
  });
});
