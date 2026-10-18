import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { TerminalDiscoveryList } from './TerminalDiscoveryList';

const terminals = [
  { id: 't-1', name: 'Counter Terminal' },
  { id: 't-2', name: 'Window Terminal' },
];

const baseProps = {
  providerLabel: 'Stripe',
  terminals,
  scanning: false,
  connecting: false,
  connectingTerminalId: null,
  hasError: false,
  onScan: jest.fn(),
  onConnect: jest.fn(),
};

describe('TerminalDiscoveryList', () => {
  it('renders the provider title and terminal rows', async () => {
    const tree = await renderUi(<TerminalDiscoveryList {...baseProps} />);
    expect(hasText(tree, 'Stripe Terminals')).toBe(true);
    expect(hasText(tree, 'Counter Terminal')).toBe(true);
    expect(hasText(tree, 'Window Terminal')).toBe(true);
  });

  it('fires onScan and onConnect', async () => {
    const onScan = jest.fn();
    const onConnect = jest.fn();
    const tree = await renderUi(<TerminalDiscoveryList {...baseProps} onScan={onScan} onConnect={onConnect} />);
    const scan = tree.root.findAll(n => n.props.accessibilityLabel === 'Scan for terminals')[0];
    scan.props.onPress();
    expect(onScan).toHaveBeenCalledTimes(1);
    const connect = tree.root.findAll(n => n.props.accessibilityLabel === 'Connect to Counter Terminal')[0];
    connect.props.onPress();
    expect(onConnect).toHaveBeenCalledWith('t-1', 'Counter Terminal');
  });

  it('shows the scanning state', async () => {
    const tree = await renderUi(<TerminalDiscoveryList {...baseProps} scanning />);
    expect(hasText(tree, 'Scanning for terminals…')).toBe(true);
  });

  it('shows the empty state when no terminals are found', async () => {
    const tree = await renderUi(<TerminalDiscoveryList {...baseProps} terminals={[]} />);
    expect(hasText(tree, 'No terminals found')).toBe(true);
    expect(hasText(tree, 'Tap refresh to scan again')).toBe(true);
  });
});
