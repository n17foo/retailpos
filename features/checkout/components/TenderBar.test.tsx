import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { TenderBar } from './TenderBar';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

describe('TenderBar', () => {
  it('renders Cash and Card tender buttons and invokes onTender', async () => {
    const onTender = jest.fn();
    const tree = await renderUi(<TenderBar total={19.99} cardAvailable onTender={onTender} />);
    expect(hasText(tree, 'Cash')).toBe(true);
    expect(hasText(tree, '£19.99')).toBe(true);
    expect(hasText(tree, 'Card')).toBe(true);

    await pressByText(tree, 'Cash');
    expect(onTender).toHaveBeenCalledWith('cash');

    await pressByText(tree, 'Card');
    expect(onTender).toHaveBeenCalledWith('card');
  });
});
