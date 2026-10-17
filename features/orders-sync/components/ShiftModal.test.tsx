import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import ShiftModal from './ShiftModal';

describe('ShiftModal', () => {
  it('renders open/close shift modal and invokes onSubmit and onClose', async () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    const tree = await renderUi(
      <ShiftModal
        visible
        mode="open"
        cashAmount="100.00"
        isProcessing={false}
        onCashAmountChange={jest.fn()}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    );
    expect(hasText(tree, 'Enter the opening cash amount in the drawer.')).toBe(true);

    await pressByText(tree, 'Open Shift');
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await pressByText(tree, 'Cancel');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
