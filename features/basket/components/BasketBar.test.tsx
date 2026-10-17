import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { BasketBar } from './BasketBar';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

describe('BasketBar', () => {
  it('renders item count and formatted total and calls onPress', async () => {
    const onPress = jest.fn();
    const tree = await renderUi(<BasketBar itemCount={3} total={14.5} onPress={onPress} />);
    expect(hasText(tree, '3')).toBe(true);
    expect(hasText(tree, '£14.50')).toBe(true);

    await pressByText(tree, 'Basket');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
