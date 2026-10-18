import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { TransferOrdersListView } from './TransferOrdersListView';
import type { TransferOrderRow } from '../repositories/ProcurementRepository';

const transfer: TransferOrderRow = {
  id: 'to-1',
  from_location: 'Main Store',
  to_location: 'Warehouse',
  status: 'draft',
  notes: 'Urgent',
  created_by: null,
  created_at: 0,
  updated_at: 0,
};

const baseProps = {
  transfers: [transfer],
  statusFilter: 'all' as const,
  isLoading: false,
  onStatusFilterChange: jest.fn(),
  onCreate: jest.fn(),
  onSelectTransfer: jest.fn(),
};

describe('TransferOrdersListView', () => {
  it('renders transfer cards with route and status', async () => {
    const tree = await renderUi(<TransferOrdersListView {...baseProps} />);
    expect(hasText(tree, 'Transfer Orders')).toBe(true);
    expect(hasText(tree, 'Main Store → Warehouse')).toBe(true);
    expect(hasText(tree, 'draft')).toBe(true);
  });

  it('fires onSelectTransfer when a card is pressed', async () => {
    const onSelectTransfer = jest.fn();
    const tree = await renderUi(<TransferOrdersListView {...baseProps} onSelectTransfer={onSelectTransfer} />);
    await pressByText(tree, 'Main Store → Warehouse');
    expect(onSelectTransfer).toHaveBeenCalledWith(transfer);
  });

  it('fires onStatusFilterChange for a filter chip', async () => {
    const onStatusFilterChange = jest.fn();
    const tree = await renderUi(<TransferOrdersListView {...baseProps} onStatusFilterChange={onStatusFilterChange} />);
    await pressByText(tree, 'received');
    expect(onStatusFilterChange).toHaveBeenCalledWith('received');
  });

  it('shows the empty state when there are no transfers', async () => {
    const tree = await renderUi(<TransferOrdersListView {...baseProps} transfers={[]} />);
    expect(hasText(tree, 'No transfer orders found')).toBe(true);
  });
});
