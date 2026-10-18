import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ReceiptPrintOptionsSection } from './ReceiptPrintOptionsSection';
import type { ReceiptConfig } from '../../hardware/hooks/useReceiptConfig';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

const options: ReceiptConfig['options'] = {
  paperWidth: 80,
  fontSize: 'medium',
  printLogo: false,
  printBarcode: false,
  printQRCode: false,
  cutPaper: true,
  openCashDrawer: false,
  copies: 2,
};

describe('ReceiptPrintOptionsSection', () => {
  it('renders paper width choices and fires onChange', async () => {
    const onChange = jest.fn();
    const tree = await renderUi(<ReceiptPrintOptionsSection options={options} onChange={onChange} />);
    expect(hasText(tree, '58mm')).toBe(true);
    await pressByText(tree, '58mm');
    expect(onChange).toHaveBeenCalledWith({ paperWidth: 58 });
  });

  it('toggles a print option', async () => {
    const onChange = jest.fn();
    const tree = await renderUi(<ReceiptPrintOptionsSection options={options} onChange={onChange} />);
    // Pressable order: 2 paper-width radios, then barcode / qr / cut / drawer toggles, then - and + copies
    const pressables = tree.root.findAll(n => typeof n.props?.onPress === 'function');
    await pressables[2].props.onPress();
    expect(onChange).toHaveBeenCalledWith({ printBarcode: true });
  });

  it('steps copies within the 1–5 range', async () => {
    const onChange = jest.fn();
    const tree = await renderUi(<ReceiptPrintOptionsSection options={options} onChange={onChange} />);
    const pressables = tree.root.findAll(n => typeof n.props?.onPress === 'function');
    await pressables[7].props.onPress(); // +
    expect(onChange).toHaveBeenCalledWith({ copies: 3 });
    await pressables[6].props.onPress(); // -
    expect(onChange).toHaveBeenCalledWith({ copies: 1 });
  });
});
