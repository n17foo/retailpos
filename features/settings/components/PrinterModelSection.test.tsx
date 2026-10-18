import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { PrinterModelSection } from './PrinterModelSection';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe('PrinterModelSection', () => {
  it('renders all printer models and fires onModelChange', async () => {
    const onModelChange = jest.fn();
    const tree = await renderUi(<PrinterModelSection selectedModel="epson" onModelChange={onModelChange} />);
    expect(hasText(tree, 'Epson')).toBe(true);
    expect(hasText(tree, 'Generic/Other')).toBe(true);
    await pressByText(tree, 'Star');
    expect(onModelChange).toHaveBeenCalledWith('star');
  });
});
