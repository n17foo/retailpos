import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { TransferOrderDetailView } from './TransferOrderDetailView';
import type { TransferOrderRow, TransferOrderItemRow } from '../repositories/ProcurementRepository';

const makeTransfer = (status: TransferOrderRow['status']): TransferOrderRow => ({
  id: 'to-1',
  from_location: 'Main Store',
  to_location: 'Warehouse',
  status,
  notes: null,
  created_by: null,
  created_at: 0,
  updated_at: 0,
});

const items: TransferOrderItemRow[] = [
  { id: 'i1', transfer_order_id: 'to-1', product_id: 'p1', variant_id: null, product_name: 'Iced Latte', transfer_qty: 5 },
];

const baseProps = {
  items,
  isProcessing: false,
  onBack: jest.fn(),
  onDispatch: jest.fn(),
  onReceive: jest.fn(),
  onCancel: jest.fn(),
};

describe('TransferOrderDetailView', () => {
  it('renders route, status and line items', async () => {
    const tree = await renderUi(<TransferOrderDetailView {...baseProps} transfer={makeTransfer('draft')} />);
    expect(hasText(tree, 'Main Store')).toBe(true);
    expect(hasText(tree, 'Warehouse')).toBe(true);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
    expect(hasText(tree, 'Qty: 5')).toBe(true);
  });

  it('shows Dispatch and Cancel actions for a draft', async () => {
    const onDispatch = jest.fn();
    const onCancel = jest.fn();
    const tree = await renderUi(
      <TransferOrderDetailView {...baseProps} transfer={makeTransfer('draft')} onDispatch={onDispatch} onCancel={onCancel} />
    );
    await pressByText(tree, 'Dispatch');
    expect(onDispatch).toHaveBeenCalledTimes(1);
    await pressByText(tree, 'Cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows Receive for an in-transit order', async () => {
    const onReceive = jest.fn();
    const tree = await renderUi(<TransferOrderDetailView {...baseProps} transfer={makeTransfer('in_transit')} onReceive={onReceive} />);
    await pressByText(tree, 'Receive');
    expect(onReceive).toHaveBeenCalledTimes(1);
    expect(hasText(tree, 'Dispatch')).toBe(false);
  });
});
