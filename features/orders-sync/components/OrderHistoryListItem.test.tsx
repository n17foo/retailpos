import React from 'react';
import { Text } from 'react-native';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { OrderHistoryListItem } from './OrderHistoryListItem';
import type { LocalOrder } from '../../basket/services/BasketServiceInterface';

jest.mock('./OrderCard', () => ({
  __esModule: true,
  default: ({ order }: { order: LocalOrder }) => <Text>OrderCard:{order.id}</Text>,
}));

const order: LocalOrder = {
  id: 'ord-1',
  items: [],
  subtotal: 10,
  tax: 2,
  total: 12,
  status: 'paid',
  syncStatus: 'synced',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const baseProps = {
  order,
  isSyncing: false,
  isAdmin: false,
  onResync: jest.fn(),
  onDelete: jest.fn(),
  onPrintReceipt: jest.fn(),
  onExchange: jest.fn(),
};

describe('OrderHistoryListItem', () => {
  it('renders the order card', async () => {
    const tree = await renderUi(<OrderHistoryListItem {...baseProps} />);
    expect(hasText(tree, 'OrderCard:ord-1')).toBe(true);
    expect(hasText(tree, 'Delete')).toBe(false);
  });

  it('shows the delete strip for admins and fires onDelete', async () => {
    const onDelete = jest.fn();
    const tree = await renderUi(<OrderHistoryListItem {...baseProps} isAdmin onDelete={onDelete} />);
    await pressByText(tree, 'Delete');
    expect(onDelete).toHaveBeenCalledWith('ord-1');
  });
});
