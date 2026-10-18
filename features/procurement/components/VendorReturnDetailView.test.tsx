import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { VendorReturnDetailView } from './VendorReturnDetailView';
import type { VendorReturnRow, VendorReturnItemRow } from '../repositories/ProcurementRepository';

const makeReturn = (status: VendorReturnRow['status']): VendorReturnRow => ({
  id: 'vr-1',
  purchase_order_id: 'po-1',
  vendor_id: 'v1',
  status,
  notes: 'Damaged goods',
  created_by: null,
  created_at: 0,
  updated_at: 0,
});

const items: VendorReturnItemRow[] = [
  { id: 'i1', vendor_return_id: 'vr-1', product_id: 'p1', variant_id: null, product_name: 'Iced Latte', return_qty: 3, reason: 'Broken' },
];

const baseProps = {
  items,
  vendorName: 'Acme Supplies',
  isProcessing: false,
  onBack: jest.fn(),
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe('VendorReturnDetailView', () => {
  it('renders vendor, status, notes and line items', async () => {
    const tree = await renderUi(<VendorReturnDetailView {...baseProps} vendorReturn={makeReturn('pending')} />);
    expect(hasText(tree, 'Acme Supplies')).toBe(true);
    expect(hasText(tree, 'pending')).toBe(true);
    expect(hasText(tree, 'Damaged goods')).toBe(true);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
    expect(hasText(tree, 'Qty: 3')).toBe(true);
    expect(hasText(tree, 'Reason: Broken')).toBe(true);
  });

  it('shows Confirm and Cancel for a pending return', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const tree = await renderUi(
      <VendorReturnDetailView {...baseProps} vendorReturn={makeReturn('pending')} onConfirm={onConfirm} onCancel={onCancel} />
    );
    await pressByText(tree, 'Confirm Return');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await pressByText(tree, 'Cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('hides actions for a confirmed return', async () => {
    const tree = await renderUi(<VendorReturnDetailView {...baseProps} vendorReturn={makeReturn('confirmed')} />);
    expect(hasText(tree, 'Confirm Return')).toBe(false);
  });
});
