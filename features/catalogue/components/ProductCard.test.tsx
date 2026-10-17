import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ProductCard } from './ProductCard';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

describe('ProductCard', () => {
  it('renders product name, price, basket quantity badge, and low-stock badge', async () => {
    const onPress = jest.fn();
    const tree = await renderUi(
      <ProductCard id="p1" name="Flat White" price={3.8} image={null} quantity={2} stock={3} sellable onPress={onPress} />
    );
    expect(hasText(tree, 'Flat White')).toBe(true);
    expect(hasText(tree, '£3.80')).toBe(true);
    expect(hasText(tree, '3 left')).toBe(true);

    await pressByText(tree, 'Flat White');
    expect(onPress).toHaveBeenCalledWith('p1');
  });
});
