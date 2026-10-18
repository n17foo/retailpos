import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { BasketMetaRow } from './BasketMetaRow';

const baseProps = {
  hasOrderNote: false,
  orderNoteVisible: false,
  onAddCustomer: jest.fn(),
  onRemoveCustomer: jest.fn(),
  onToggleOrderNote: jest.fn(),
};

describe('BasketMetaRow', () => {
  it('shows the add-customer button when no customer is attached', async () => {
    const onAddCustomer = jest.fn();
    const tree = await renderUi(<BasketMetaRow {...baseProps} onAddCustomer={onAddCustomer} />);
    await pressByText(tree, 'Customer');
    expect(onAddCustomer).toHaveBeenCalledTimes(1);
  });

  it('shows the customer badge with name and remove control when attached', async () => {
    const onRemoveCustomer = jest.fn();
    const tree = await renderUi(
      <BasketMetaRow {...baseProps} customerEmail="sam@example.com" customerName="Sam" onRemoveCustomer={onRemoveCustomer} />
    );
    expect(hasText(tree, 'Sam')).toBe(true);
    expect(hasText(tree, 'Customer')).toBe(false);
    const removeBtn = tree.root.findAll(n => n.props?.accessibilityLabel === 'Remove customer')[0];
    await removeBtn.props.onPress();
    expect(onRemoveCustomer).toHaveBeenCalledTimes(1);
  });

  it('toggles the order note editor', async () => {
    const onToggleOrderNote = jest.fn();
    const tree = await renderUi(<BasketMetaRow {...baseProps} onToggleOrderNote={onToggleOrderNote} />);
    await pressByText(tree, 'Note');
    expect(onToggleOrderNote).toHaveBeenCalledTimes(1);
  });
});
