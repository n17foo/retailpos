import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ReceiptPreview } from './ReceiptPreview';

describe('ReceiptPreview', () => {
  it('renders receipt lines and calls onPrint and onClose', async () => {
    const onPrint = jest.fn();
    const onClose = jest.fn();
    const tree = await renderUi(<ReceiptPreview visible lines={['STORE NAME', 'Latte x1   £3.50']} onPrint={onPrint} onClose={onClose} />);
    expect(hasText(tree, 'STORE NAME')).toBe(true);
    expect(hasText(tree, 'Latte x1   £3.50')).toBe(true);

    await pressByText(tree, 'Print');
    expect(onPrint).toHaveBeenCalledTimes(1);

    await pressByText(tree, 'Close');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
