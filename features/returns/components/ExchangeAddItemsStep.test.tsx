import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ExchangeAddItemsStep } from './ExchangeAddItemsStep';
import type { ExchangeSession } from '../services/exchange/ExchangeService';
import type { BasketItem } from '../../basket/services/basket';

const newItem: BasketItem = {
  id: 'line-1',
  productId: 'p1',
  name: 'Exchange Item',
  price: 10,
  quantity: 1,
};

const makeSession = (overrides: Partial<ExchangeSession> = {}): ExchangeSession => ({
  id: 'ex-1',
  originalOrderId: 'ord-1',
  returnItems: [],
  returnCredit: 0,
  newItems: [newItem],
  newItemsTotal: 10,
  netDue: 5,
  payments: [],
  remainingDue: 5,
  ...overrides,
});

const baseProps = {
  session: makeSession(),
  currencyCode: 'USD',
  onAddProduct: jest.fn(),
  onRemoveItem: jest.fn(),
  onNext: jest.fn(),
};

describe('ExchangeAddItemsStep', () => {
  it('shows the amount-due banner and new item rows', async () => {
    const tree = await renderUi(<ExchangeAddItemsStep {...baseProps} />);
    expect(hasText(tree, 'Amount due: $5.00')).toBe(true);
    expect(hasText(tree, 'Exchange Item')).toBe(true);
    expect(hasText(tree, '$10.00 × 1')).toBe(true);
  });

  it('shows the refund-due banner for a negative net', async () => {
    const tree = await renderUi(<ExchangeAddItemsStep {...baseProps} session={makeSession({ netDue: -3, remainingDue: -3 })} />);
    expect(hasText(tree, 'Refund due: $3.00')).toBe(true);
  });

  it('fires onRemoveItem and onAddProduct', async () => {
    const onRemoveItem = jest.fn();
    const onAddProduct = jest.fn();
    const tree = await renderUi(<ExchangeAddItemsStep {...baseProps} onRemoveItem={onRemoveItem} onAddProduct={onAddProduct} />);
    const remove = tree.root.findAll(n => n.props.accessibilityLabel === 'Remove item')[0];
    remove.props.onPress();
    expect(onRemoveItem).toHaveBeenCalledWith('line-1');
    await pressByText(tree, '+ Add Sample Item ($10.00)');
    expect(onAddProduct).toHaveBeenCalledWith(expect.objectContaining({ name: 'Exchange Item', price: 10 }));
  });

  it('fires onNext', async () => {
    const onNext = jest.fn();
    const tree = await renderUi(<ExchangeAddItemsStep {...baseProps} onNext={onNext} />);
    await pressByText(tree, 'Next: Settle Payment');
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
