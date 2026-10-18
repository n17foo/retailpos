import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { VendorReturnCreateView } from './VendorReturnCreateView';
import type { PurchaseOrderItemRow } from '../repositories/ProcurementRepository';

const poItems: PurchaseOrderItemRow[] = [
  {
    id: 'poi-1',
    purchase_order_id: 'po-1',
    product_id: 'p1',
    variant_id: null,
    product_name: 'Iced Latte',
    ordered_qty: 10,
    received_qty: 8,
    unit_cost: 1.5,
  },
];

const baseProps = {
  purchaseOrders: [],
  vendors: [],
  selectedPOId: '',
  selectedVendorId: '',
  notes: '',
  poItems,
  returnQtys: {},
  isProcessing: false,
  onBack: jest.fn(),
  onSelectPO: jest.fn(),
  onNotesChange: jest.fn(),
  onReturnQtyChange: jest.fn(),
  onCreate: jest.fn(),
};

describe('VendorReturnCreateView', () => {
  it('renders the PO picker placeholder and return item rows', async () => {
    const tree = await renderUi(<VendorReturnCreateView {...baseProps} />);
    expect(hasText(tree, 'New Vendor Return')).toBe(true);
    expect(hasText(tree, 'Select a purchase order')).toBe(true);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
    expect(hasText(tree, 'Received: 8')).toBe(true);
  });

  it('fires onReturnQtyChange for qty and reason inputs', async () => {
    const onReturnQtyChange = jest.fn();
    const tree = await renderUi(<VendorReturnCreateView {...baseProps} onReturnQtyChange={onReturnQtyChange} />);
    const qtyInput = tree.root.findAll(n => n.type === 'TextInput' && n.props.placeholder === 'Qty')[0];
    qtyInput.props.onChangeText('2');
    expect(onReturnQtyChange).toHaveBeenCalledWith('poi-1', 'qty', '2');
    const reasonInput = tree.root.findAll(n => n.type === 'TextInput' && n.props.placeholder === 'Reason (optional)')[0];
    reasonInput.props.onChangeText('Damaged');
    expect(onReturnQtyChange).toHaveBeenCalledWith('poi-1', 'reason', 'Damaged');
  });

  it('fires onCreate', async () => {
    const onCreate = jest.fn();
    const tree = await renderUi(<VendorReturnCreateView {...baseProps} selectedPOId="po-1" onCreate={onCreate} />);
    await pressByText(tree, 'Create Return');
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
