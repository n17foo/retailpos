import React from 'react';
import { renderUi, hasText, pressByText, act } from '../../../tests/testUtils';
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

const catalogue = [
  { id: 'prod-1', name: 'Green Tea', price: 4.5, sku: 'GT-1' },
  { id: 'prod-2', name: 'Cold Brew', price: 6.25, sku: 'CB-2' },
];

const baseProps = {
  session: makeSession(),
  currencyCode: 'USD',
  products: catalogue,
  isLoadingProducts: false,
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

  it('fires onRemoveItem and onAddProduct from the catalogue list', async () => {
    const onRemoveItem = jest.fn();
    const onAddProduct = jest.fn();
    const tree = await renderUi(<ExchangeAddItemsStep {...baseProps} onRemoveItem={onRemoveItem} onAddProduct={onAddProduct} />);
    const remove = tree.root.findAll(n => n.props.accessibilityLabel === 'Remove item')[0];
    remove.props.onPress();
    expect(onRemoveItem).toHaveBeenCalledWith('line-1');
    // Catalogue rows are real products — no fake sample item exists (RET-02)
    const addRow = tree.root.findAll(n => n.props.accessibilityLabel === 'Add Green Tea')[0];
    addRow.props.onPress();
    expect(onAddProduct).toHaveBeenCalledWith(expect.objectContaining({ id: 'prod-1', name: 'Green Tea', price: 4.5 }));
  });

  it('filters the catalogue by the search field', async () => {
    const tree = await renderUi(<ExchangeAddItemsStep {...baseProps} />);
    const input = tree.root.findAll(n => n.props.accessibilityLabel === 'Search products')[0];
    await act(async () => {
      input.props.onChangeText('cold');
    });
    expect(tree.root.findAll(n => n.props.accessibilityLabel === 'Add Cold Brew')).toHaveLength(1);
    expect(tree.root.findAll(n => n.props.accessibilityLabel === 'Add Green Tea')).toHaveLength(0);
  });

  it('fires onNext', async () => {
    const onNext = jest.fn();
    const tree = await renderUi(<ExchangeAddItemsStep {...baseProps} onNext={onNext} />);
    await pressByText(tree, 'Next: Settle Payment');
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
