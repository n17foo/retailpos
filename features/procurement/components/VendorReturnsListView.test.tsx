import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { VendorReturnsListView } from './VendorReturnsListView';
import type { VendorReturnRow, VendorRow } from '../repositories/ProcurementRepository';

const vendors: VendorRow[] = [
  {
    id: 'v1',
    name: 'Acme Supplies',
    contact_name: null,
    email: null,
    phone: null,
    address: null,
    notes: null,
    created_at: 0,
    updated_at: 0,
    deleted_at: null,
  },
];

const vendorReturn: VendorReturnRow = {
  id: 'vr-1',
  purchase_order_id: 'po-1',
  vendor_id: 'v1',
  status: 'pending',
  notes: 'Damaged goods',
  created_by: null,
  created_at: 0,
  updated_at: 0,
};

const baseProps = {
  returns: [vendorReturn],
  vendors,
  statusFilter: 'all' as const,
  isLoading: false,
  onStatusFilterChange: jest.fn(),
  onCreate: jest.fn(),
  onSelectReturn: jest.fn(),
};

describe('VendorReturnsListView', () => {
  it('renders the vendor name, status and notes for each return', async () => {
    const tree = await renderUi(<VendorReturnsListView {...baseProps} />);
    expect(hasText(tree, 'Vendor Returns')).toBe(true);
    expect(hasText(tree, 'Acme Supplies')).toBe(true);
    expect(hasText(tree, 'pending')).toBe(true);
    expect(hasText(tree, 'Damaged goods')).toBe(true);
  });

  it('fires onSelectReturn when a card is pressed', async () => {
    const onSelectReturn = jest.fn();
    const tree = await renderUi(<VendorReturnsListView {...baseProps} onSelectReturn={onSelectReturn} />);
    await pressByText(tree, 'Acme Supplies');
    expect(onSelectReturn).toHaveBeenCalledWith(vendorReturn);
  });

  it('fires onStatusFilterChange for a filter chip', async () => {
    const onStatusFilterChange = jest.fn();
    const tree = await renderUi(<VendorReturnsListView {...baseProps} onStatusFilterChange={onStatusFilterChange} />);
    await pressByText(tree, 'confirmed');
    expect(onStatusFilterChange).toHaveBeenCalledWith('confirmed');
  });

  it('shows the empty state when there are no returns', async () => {
    const tree = await renderUi(<VendorReturnsListView {...baseProps} returns={[]} />);
    expect(hasText(tree, 'No vendor returns found')).toBe(true);
  });
});
