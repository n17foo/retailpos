import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { RefundHistoryList } from './RefundHistoryList';
import type { RefundRecord } from '../services/refunds/RefundService';

const record: RefundRecord = {
  id: 'refund-0000abcd',
  orderId: 'ord-1',
  amount: 12.5,
  reason: 'Damaged item',
  status: 'completed',
  source: 'payment_terminal',
  timestamp: new Date(0),
};

describe('RefundHistoryList', () => {
  it('renders refund records with status, amount and reason', async () => {
    const tree = await renderUi(<RefundHistoryList history={[record]} isLoading={false} currencyCode="USD" />);
    expect(hasText(tree, 'Refund History')).toBe(true);
    expect(hasText(tree, '#0000abcd')).toBe(true);
    expect(hasText(tree, 'completed')).toBe(true);
    expect(hasText(tree, '$12.50')).toBe(true);
    expect(hasText(tree, 'Damaged item')).toBe(true);
  });

  it('shows the empty state when there is no history', async () => {
    const tree = await renderUi(<RefundHistoryList history={[]} isLoading={false} currencyCode="USD" />);
    expect(hasText(tree, 'No refund history available')).toBe(true);
  });
});
