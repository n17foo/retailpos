import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { SplitTenderStep } from './SplitTenderStep';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

const baseProps = {
  visible: true,
  orderTotal: 20,
  paymentLines: [{ id: 'l1', method: 'cash' as const, amount: 10, processedAt: 1 }],
  splitAmountStr: '',
  onSplitAmountChange: jest.fn(),
  splitMethod: 'cash' as const,
  onSplitMethodChange: jest.fn(),
  paymentMode: 'cash_only' as const,
  loyaltyPoints: 0,
  storeCreditDollars: 0,
  error: null,
  isProcessing: false,
  onAddPaymentLine: jest.fn(),
  onRemovePaymentLine: jest.fn(),
  onCompleteSplit: jest.fn(),
  onBack: jest.fn(),
  onCancel: jest.fn(),
};

describe('SplitTenderStep', () => {
  it('renders collected lines and remaining balance', async () => {
    const tree = await renderUi(<SplitTenderStep {...baseProps} />);
    expect(hasText(tree, 'Split Payment')).toBe(true);
    expect(hasText(tree, '💵 Cash')).toBe(true);
    expect(hasText(tree, '£10.00')).toBe(true); // collected + remaining
  });

  it('fires onRemovePaymentLine when a line ✕ is pressed', async () => {
    const onRemovePaymentLine = jest.fn();
    const tree = await renderUi(<SplitTenderStep {...baseProps} onRemovePaymentLine={onRemovePaymentLine} />);
    await pressByText(tree, '✕');
    expect(onRemovePaymentLine).toHaveBeenCalledWith('l1');
  });

  it('adds a payment line when amount is valid and clears the input', async () => {
    const onAddPaymentLine = jest.fn();
    const onSplitAmountChange = jest.fn();
    const tree = await renderUi(
      <SplitTenderStep {...baseProps} splitAmountStr="10" onAddPaymentLine={onAddPaymentLine} onSplitAmountChange={onSplitAmountChange} />
    );
    await pressByText(tree, 'Add Payment');
    expect(onAddPaymentLine).toHaveBeenCalledWith({ method: 'cash', amount: 10 });
    expect(onSplitAmountChange).toHaveBeenCalledWith('');
  });

  it('does not add a line when the amount exceeds the remaining balance', async () => {
    const onAddPaymentLine = jest.fn();
    const tree = await renderUi(<SplitTenderStep {...baseProps} splitAmountStr="15" onAddPaymentLine={onAddPaymentLine} />);
    await pressByText(tree, 'Add Payment');
    expect(onAddPaymentLine).not.toHaveBeenCalled();
  });

  it('enables Complete Sale once the order is settled', async () => {
    const onCompleteSplit = jest.fn();
    const settledLines = [{ id: 'l1', method: 'cash' as const, amount: 20, processedAt: 1 }];
    const tree = await renderUi(<SplitTenderStep {...baseProps} paymentLines={settledLines} onCompleteSplit={onCompleteSplit} />);
    await pressByText(tree, 'Complete Sale');
    expect(onCompleteSplit).toHaveBeenCalledTimes(1);
  });
});
