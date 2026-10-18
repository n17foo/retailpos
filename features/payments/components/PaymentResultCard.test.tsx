import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { PaymentResultCard } from './PaymentResultCard';
import type { PaymentResponse } from '../services/PaymentServiceInterface';

const success: PaymentResponse = {
  success: true,
  transactionId: 'txn-123456789012',
  cardBrand: 'Visa',
  last4: '4242',
  timestamp: new Date(0),
};

const failure: PaymentResponse = {
  success: false,
  errorMessage: 'Card declined',
  timestamp: new Date(0),
};

const baseProps = {
  retryCount: 0,
  maxRetries: 3,
  onRetry: jest.fn(),
};

describe('PaymentResultCard', () => {
  it('renders the accepted state with transaction ref and card', async () => {
    const tree = await renderUi(<PaymentResultCard {...baseProps} result={success} />);
    expect(hasText(tree, 'Payment Accepted')).toBe(true);
    expect(hasText(tree, 'Ref: 123456789012')).toBe(true);
    expect(hasText(tree, 'Visa ···· 4242')).toBe(true);
    expect(hasText(tree, 'Try Again')).toBe(false);
  });

  it('renders the declined state and fires onRetry', async () => {
    const onRetry = jest.fn();
    const tree = await renderUi(<PaymentResultCard {...baseProps} result={failure} onRetry={onRetry} />);
    expect(hasText(tree, 'Payment Declined')).toBe(true);
    expect(hasText(tree, 'Card declined')).toBe(true);
    const retry = tree.root.findAll(n => n.props.accessibilityLabel === 'Try payment again')[0];
    retry.props.onPress();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows remaining attempts after retries', async () => {
    const tree = await renderUi(<PaymentResultCard {...baseProps} result={failure} retryCount={1} />);
    expect(hasText(tree, 'Try Again (2 left)')).toBe(true);
  });
});
