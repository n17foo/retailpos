import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { LabelFormatCard } from './LabelFormatCard';
import type { LabelFormat } from '../services/BarcodeLabelService';

const format: LabelFormat = {
  width: 50,
  height: 30,
  fontSize: 'medium',
  includePrice: true,
  includeName: true,
  includeSku: false,
};

describe('LabelFormatCard', () => {
  it('renders the title, font sizes and format toggles', async () => {
    const tree = await renderUi(<LabelFormatCard format={format} onFormatChange={jest.fn()} />);
    expect(hasText(tree, 'Label Format')).toBe(true);
    expect(hasText(tree, 'small')).toBe(true);
    expect(hasText(tree, 'Product Name')).toBe(true);
    expect(hasText(tree, 'SKU')).toBe(true);
    expect(hasText(tree, 'Price')).toBe(true);
  });

  it('fires onFormatChange with a fontSize updater', async () => {
    const onFormatChange = jest.fn();
    const tree = await renderUi(<LabelFormatCard format={format} onFormatChange={onFormatChange} />);
    await pressByText(tree, 'large');
    const updater = onFormatChange.mock.calls[0][0] as (prev: LabelFormat) => LabelFormat;
    expect(updater(format)).toEqual({ ...format, fontSize: 'large' });
  });

  it('fires onFormatChange with a flag-toggling updater', async () => {
    const onFormatChange = jest.fn();
    const tree = await renderUi(<LabelFormatCard format={format} onFormatChange={onFormatChange} />);
    await pressByText(tree, 'Price');
    const updater = onFormatChange.mock.calls[0][0] as (prev: LabelFormat) => LabelFormat;
    expect(updater(format)).toEqual({ ...format, includePrice: false });
  });
});
