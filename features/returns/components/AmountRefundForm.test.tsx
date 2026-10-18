import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { AmountRefundForm } from './AmountRefundForm';

const baseProps = {
  idLabel: 'Transaction ID',
  idPlaceholder: 'Enter transaction ID',
  idValue: '',
  amount: '',
  reason: '',
  onIdChange: jest.fn(),
  onAmountChange: jest.fn(),
  onReasonChange: jest.fn(),
};

describe('AmountRefundForm', () => {
  it('renders the id, amount and reason fields', async () => {
    const tree = await renderUi(<AmountRefundForm {...baseProps} />);
    expect(hasText(tree, 'Transaction ID')).toBe(true);
    expect(hasText(tree, 'Amount')).toBe(true);
    expect(hasText(tree, 'Reason')).toBe(true);
  });

  it('fires the three change callbacks', async () => {
    const onIdChange = jest.fn();
    const onAmountChange = jest.fn();
    const onReasonChange = jest.fn();
    const tree = await renderUi(
      <AmountRefundForm {...baseProps} onIdChange={onIdChange} onAmountChange={onAmountChange} onReasonChange={onReasonChange} />
    );
    const inputs = tree.root.findAll(n => n.type === 'TextInput');
    inputs[0].props.onChangeText('txn-1');
    expect(onIdChange).toHaveBeenCalledWith('txn-1');
    inputs[1].props.onChangeText('9.99');
    expect(onAmountChange).toHaveBeenCalledWith('9.99');
    inputs[2].props.onChangeText('oops');
    expect(onReasonChange).toHaveBeenCalledWith('oops');
  });
});
