import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import { MethodSelectStep } from './MethodSelectStep';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string, params?: Record<string, string>) => (params ? `${k}:${Object.values(params).join(',')}` : k) }),
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

const baseProps = {
  visible: true,
  orderId: 'order-12345678',
  orderTotal: 10.76,
  orderSubtotal: 8.97,
  orderTax: 1.79,
  itemCount: 3,
  selectedMethod: 'cash' as const,
  onSelectMethod: jest.fn(),
  terminalConnected: false,
  paymentMode: 'cash_only' as const,
  loyaltyPoints: 0,
  storeCreditDollars: 0,
  error: null,
  isProcessing: false,
  onConfirm: jest.fn(),
  onSplit: jest.fn(),
  onCancel: jest.fn(),
};

describe('MethodSelectStep', () => {
  it('renders the order summary with formatted totals', async () => {
    const tree = await renderUi(<MethodSelectStep {...baseProps} />);
    expect(hasText(tree, 'checkout.orderRef:12345678')).toBe(true);
    expect(hasText(tree, '£8.97')).toBe(true);
    expect(hasText(tree, '£1.79')).toBe(true);
    expect(hasText(tree, '£10.76')).toBe(true);
    expect(hasText(tree, 'Cash')).toBe(true);
  });

  it('fires onConfirm from the primary button', async () => {
    const onConfirm = jest.fn();
    const tree = await renderUi(<MethodSelectStep {...baseProps} onConfirm={onConfirm} />);
    await pressByText(tree, 'checkout.enterCashAmount');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('fires onSplit from the Split Payment button', async () => {
    const onSplit = jest.fn();
    const tree = await renderUi(<MethodSelectStep {...baseProps} onSplit={onSplit} />);
    await pressByText(tree, 'Split Payment');
    expect(onSplit).toHaveBeenCalledTimes(1);
  });

  it('shows the terminal option in tap_to_pay mode and calls onSelectMethod', async () => {
    const onSelectMethod = jest.fn();
    const tree = await renderUi(
      <MethodSelectStep
        {...baseProps}
        paymentMode="tap_to_pay"
        activeProvider={PaymentProvider.STRIPE}
        terminalConnected
        onSelectMethod={onSelectMethod}
      />
    );
    expect(hasText(tree, 'Card Terminal (Stripe Terminal)')).toBe(true);
    await pressByText(tree, 'Card Terminal (Stripe Terminal)');
    expect(onSelectMethod).toHaveBeenCalledWith('terminal');
  });

  it('renders the error banner when error is set', async () => {
    const tree = await renderUi(<MethodSelectStep {...baseProps} error="Payment declined" />);
    expect(hasText(tree, 'Payment declined')).toBe(true);
  });
});
