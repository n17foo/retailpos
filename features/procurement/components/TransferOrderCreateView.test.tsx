import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { TransferOrderCreateView } from './TransferOrderCreateView';

const baseProps = {
  products: [{ id: 'p1', name: 'Iced Latte' }],
  selectedProducts: [{ productId: 'p1', quantity: 2 }],
  fromLocation: '',
  toLocation: '',
  notes: '',
  isProcessing: false,
  onBack: jest.fn(),
  onFromLocationChange: jest.fn(),
  onToLocationChange: jest.fn(),
  onNotesChange: jest.fn(),
  onAddProduct: jest.fn(),
  onRemoveProduct: jest.fn(),
  onQuantityChange: jest.fn(),
  onCreate: jest.fn(),
};

describe('TransferOrderCreateView', () => {
  it('renders location fields and the selected product row', async () => {
    const tree = await renderUi(<TransferOrderCreateView {...baseProps} />);
    expect(hasText(tree, 'New Transfer')).toBe(true);
    expect(hasText(tree, 'From Location *')).toBe(true);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
  });

  it('fires onCreate and onAddProduct', async () => {
    const onCreate = jest.fn();
    const onAddProduct = jest.fn();
    const tree = await renderUi(<TransferOrderCreateView {...baseProps} onCreate={onCreate} onAddProduct={onAddProduct} />);
    await pressByText(tree, 'Create Transfer');
    expect(onCreate).toHaveBeenCalledTimes(1);
    await pressByText(tree, 'Add Product');
    expect(onAddProduct).toHaveBeenCalledTimes(1);
  });

  it('fires onQuantityChange with the row index', async () => {
    const onQuantityChange = jest.fn();
    const tree = await renderUi(<TransferOrderCreateView {...baseProps} onQuantityChange={onQuantityChange} />);
    const qtyInput = tree.root.findAll(n => n.type === 'TextInput' && n.props.value === '2')[0];
    qtyInput.props.onChangeText('7');
    expect(onQuantityChange).toHaveBeenCalledWith(0, '7');
  });
});
