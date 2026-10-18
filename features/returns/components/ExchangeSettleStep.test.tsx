import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ExchangeSettleStep } from './ExchangeSettleStep';
import type { ExchangeSession } from '../services/exchange/ExchangeService';
import type { PaymentLine } from '../../orders-sync/services/order/order';

const payment: PaymentLine = {
  id: 'pay-1',
  method: 'cash',
  amount: 5,
  processedAt: 0,
};

const makeSession = (overrides: Partial<ExchangeSession> = {}): ExchangeSession => ({
  id: 'ex-1',
  originalOrderId: 'ord-1',
  returnItems: [],
  returnCredit: 5,
  newItems: [],
  newItemsTotal: 10,
  netDue: 5,
  payments: [],
  remainingDue: 5,
  ...overrides,
});

const baseProps = {
  session: makeSession(),
  currencyCode: 'USD',
  settleMethod: 'cash' as const,
  settleAmountStr: '5.00',
  isProcessing: false,
  onMethodChange: jest.fn(),
  onAmountChange: jest.fn(),
  onAddPayment: jest.fn(),
  onRemovePayment: jest.fn(),
  onComplete: jest.fn(),
};

describe('ExchangeSettleStep', () => {
  it('renders the summary and the add-payment section while money is due', async () => {
    const tree = await renderUi(<ExchangeSettleStep {...baseProps} />);
    expect(hasText(tree, 'Return credit')).toBe(true);
    expect(hasText(tree, 'Net due')).toBe(true);
    expect(hasText(tree, 'Remaining')).toBe(true);
    expect(hasText(tree, 'Add payment')).toBe(true);
  });

  it('fires onMethodChange, onAmountChange and onAddPayment', async () => {
    const onMethodChange = jest.fn();
    const onAmountChange = jest.fn();
    const onAddPayment = jest.fn();
    const tree = await renderUi(
      <ExchangeSettleStep {...baseProps} onMethodChange={onMethodChange} onAmountChange={onAmountChange} onAddPayment={onAddPayment} />
    );
    await pressByText(tree, '💳 Card');
    expect(onMethodChange).toHaveBeenCalledWith('card');
    const amountInput = tree.root.findAll(n => n.type === 'TextInput')[0];
    amountInput.props.onChangeText('3.00');
    expect(onAmountChange).toHaveBeenCalledWith('3.00');
    await pressByText(tree, 'Add Payment');
    expect(onAddPayment).toHaveBeenCalledTimes(1);
  });

  it('lists collected payments and fires onRemovePayment', async () => {
    const onRemovePayment = jest.fn();
    const tree = await renderUi(
      <ExchangeSettleStep
        {...baseProps}
        session={makeSession({ payments: [payment], remainingDue: 0 })}
        onRemovePayment={onRemovePayment}
      />
    );
    expect(hasText(tree, 'Payments collected')).toBe(true);
    expect(hasText(tree, '💵 Cash')).toBe(true);
    const remove = tree.root.findAll(n => n.props.accessibilityLabel === 'Remove payment')[0];
    remove.props.onPress();
    expect(onRemovePayment).toHaveBeenCalledWith('pay-1');
  });

  it('hides the add-payment section when fully paid and fires onComplete', async () => {
    const onComplete = jest.fn();
    const tree = await renderUi(
      <ExchangeSettleStep {...baseProps} session={makeSession({ payments: [payment], remainingDue: 0 })} onComplete={onComplete} />
    );
    expect(hasText(tree, 'Add payment')).toBe(false);
    await pressByText(tree, 'Complete Exchange');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
