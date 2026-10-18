import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { BarcodeLabelProductRow } from './BarcodeLabelProductRow';
import type { ProductSelection } from './BarcodeLabelProductRow';

const item: ProductSelection = {
  productId: 'p1',
  name: 'Iced Latte',
  sku: 'ICL-01',
  price: 2.99,
  selected: true,
  quantity: 2,
};

const baseProps = {
  item,
  currencyCode: 'USD',
  onToggle: jest.fn(),
  onQuantityChange: jest.fn(),
};

describe('BarcodeLabelProductRow', () => {
  it('renders name, SKU, price and quantity input when selected', async () => {
    const tree = await renderUi(<BarcodeLabelProductRow {...baseProps} />);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
    expect(hasText(tree, 'SKU: ICL-01')).toBe(true);
    expect(hasText(tree, '$2.99')).toBe(true);
    expect(hasText(tree, 'Qty:')).toBe(true);
  });

  it('hides the quantity input when not selected', async () => {
    const tree = await renderUi(<BarcodeLabelProductRow {...baseProps} item={{ ...item, selected: false }} />);
    expect(hasText(tree, 'Qty:')).toBe(false);
  });

  it('fires onToggle and onQuantityChange', async () => {
    const onToggle = jest.fn();
    const onQuantityChange = jest.fn();
    const tree = await renderUi(<BarcodeLabelProductRow {...baseProps} onToggle={onToggle} onQuantityChange={onQuantityChange} />);
    await pressByText(tree, 'Iced Latte');
    expect(onToggle).toHaveBeenCalledWith('p1');
    const qtyInput = tree.root.findAll(n => n.type === 'TextInput')[0];
    qtyInput.props.onChangeText('5');
    expect(onQuantityChange).toHaveBeenCalledWith('p1', '5');
  });
});
