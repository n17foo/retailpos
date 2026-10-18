import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ExchangeReturnItemsStep } from './ExchangeReturnItemsStep';
import type { ReturnableItem } from './ExchangeReturnItemsStep';

const item: ReturnableItem = {
  orderItemId: 'oi-1',
  productId: 'p1',
  variantId: null,
  name: 'Iced Latte',
  price: 2.99,
  originalQuantity: 3,
  returnedQuantity: 0,
  returnableQuantity: 3,
};

const baseProps = {
  orderId: 'order-00001234',
  items: [item],
  quantities: { 'oi-1': 1 },
  currencyCode: 'USD',
  onQuantityChange: jest.fn(),
  onNext: jest.fn(),
};

describe('ExchangeReturnItemsStep', () => {
  it('renders item name, availability and return credit', async () => {
    const tree = await renderUi(<ExchangeReturnItemsStep {...baseProps} />);
    expect(hasText(tree, 'Select items to return from order #00001234')).toBe(true);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
    expect(hasText(tree, 'Return credit: $2.99')).toBe(true);
  });

  it('fires onQuantityChange via the +/- controls', async () => {
    const onQuantityChange = jest.fn();
    const tree = await renderUi(<ExchangeReturnItemsStep {...baseProps} onQuantityChange={onQuantityChange} />);
    const increase = tree.root.findAll(n => n.props.accessibilityLabel === 'Increase quantity')[0];
    increase.props.onPress();
    expect(onQuantityChange).toHaveBeenCalledWith('oi-1', 1);
    const decrease = tree.root.findAll(n => n.props.accessibilityLabel === 'Decrease quantity')[0];
    decrease.props.onPress();
    expect(onQuantityChange).toHaveBeenCalledWith('oi-1', -1);
  });

  it('fires onNext', async () => {
    const onNext = jest.fn();
    const tree = await renderUi(<ExchangeReturnItemsStep {...baseProps} onNext={onNext} />);
    await pressByText(tree, 'Next: Add New Items');
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when no returnable items exist', async () => {
    const tree = await renderUi(<ExchangeReturnItemsStep {...baseProps} items={[]} quantities={{}} />);
    expect(hasText(tree, 'No returnable items found for this order.')).toBe(true);
  });
});
