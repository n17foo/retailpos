import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { TerminalChargePanel } from './TerminalChargePanel';

const baseProps = {
  terminalName: 'Counter Terminal',
  processing: false,
  amount: 12.5,
  currencyCode: 'USD',
  onDisconnect: jest.fn(),
  onCharge: jest.fn(),
};

describe('TerminalChargePanel', () => {
  it('shows the connected terminal and a charge button', async () => {
    const tree = await renderUi(<TerminalChargePanel {...baseProps} />);
    expect(hasText(tree, 'Counter Terminal')).toBe(true);
    expect(hasText(tree, 'Charge $12.50')).toBe(true);
  });

  it('fires onCharge and onDisconnect', async () => {
    const onCharge = jest.fn();
    const onDisconnect = jest.fn();
    const tree = await renderUi(<TerminalChargePanel {...baseProps} onCharge={onCharge} onDisconnect={onDisconnect} />);
    const charge = tree.root.findAll(n => n.props.accessibilityLabel === 'Charge $12.50')[0];
    charge.props.onPress();
    expect(onCharge).toHaveBeenCalledTimes(1);
    const disconnect = tree.root.findAll(n => n.props.accessibilityLabel === 'Disconnect terminal')[0];
    disconnect.props.onPress();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('shows the processing state', async () => {
    const tree = await renderUi(<TerminalChargePanel {...baseProps} processing />);
    expect(hasText(tree, 'Processing payment…')).toBe(true);
    expect(hasText(tree, 'Present card to terminal')).toBe(true);
    expect(hasText(tree, 'Charge $12.50')).toBe(false);
  });

  it('shows a generic label when no amount is set', async () => {
    const tree = await renderUi(<TerminalChargePanel {...baseProps} amount={0} />);
    expect(hasText(tree, 'Process Payment')).toBe(true);
  });
});
