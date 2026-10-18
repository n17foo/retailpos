import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ReturnItemsForm } from './ReturnItemsForm';
import type { ReturnableItem } from './ExchangeReturnItemsStep';
import type { ReturnItemInput } from './ReturnItemsForm';

const returnable: ReturnableItem = {
  orderItemId: 'oi-1',
  productId: 'p1',
  variantId: null,
  name: 'Iced Latte',
  price: 2.99,
  originalQuantity: 3,
  returnedQuantity: 0,
  returnableQuantity: 3,
};

const returnItem: ReturnItemInput = {
  orderItemId: 'oi-1',
  productId: 'p1',
  productName: 'Iced Latte',
  quantity: 2,
  refundAmount: 5.98,
};

const baseProps = {
  orderId: 'ord-1',
  returnableItems: [returnable],
  isLoadingReturnable: false,
  returnItems: [],
  issueRefund: false,
  reason: '',
  currencyCode: 'USD',
  onOrderIdChange: jest.fn(),
  onAddItem: jest.fn(),
  onRemoveItem: jest.fn(),
  onUpdateItemQuantity: jest.fn(),
  onIssueRefundChange: jest.fn(),
  onReasonChange: jest.fn(),
};

describe('ReturnItemsForm', () => {
  it('renders the order ID field and returnable items', async () => {
    const tree = await renderUi(<ReturnItemsForm {...baseProps} />);
    expect(hasText(tree, 'Order ID')).toBe(true);
    expect(hasText(tree, 'Available Items to Return')).toBe(true);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
    expect(hasText(tree, '3 available · $2.99 each')).toBe(true);
  });

  it('fires onAddItem for a returnable item', async () => {
    const onAddItem = jest.fn();
    const tree = await renderUi(<ReturnItemsForm {...baseProps} onAddItem={onAddItem} />);
    await pressByText(tree, 'Add');
    expect(onAddItem).toHaveBeenCalledWith(returnable);
  });

  it('shows the empty-returnable message when an order has no items', async () => {
    const tree = await renderUi(<ReturnItemsForm {...baseProps} returnableItems={[]} />);
    expect(hasText(tree, 'No returnable items found for this order')).toBe(true);
  });

  it('renders selected items and fires quantity/remove callbacks', async () => {
    const onUpdateItemQuantity = jest.fn();
    const onRemoveItem = jest.fn();
    const tree = await renderUi(
      <ReturnItemsForm {...baseProps} returnItems={[returnItem]} onUpdateItemQuantity={onUpdateItemQuantity} onRemoveItem={onRemoveItem} />
    );
    expect(hasText(tree, 'Items to Return')).toBe(true);
    expect(hasText(tree, 'Issue monetary refund')).toBe(true);
    const touchables = tree.root.findAll(n => n.type === 'TouchableOpacity' && n.props.disabled !== true && n.props.onPress);
    for (const t of touchables) t.props.onPress();
    expect(onUpdateItemQuantity).toHaveBeenCalled();
    expect(onRemoveItem).toHaveBeenCalledWith(0);
  });

  it('toggles the refund checkbox', async () => {
    const onIssueRefundChange = jest.fn();
    const tree = await renderUi(<ReturnItemsForm {...baseProps} returnItems={[returnItem]} onIssueRefundChange={onIssueRefundChange} />);
    await pressByText(tree, 'Issue monetary refund');
    expect(onIssueRefundChange).toHaveBeenCalledWith(true);
  });
});
