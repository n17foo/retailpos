import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { SearchResults } from './SearchResults';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

describe('SearchResults', () => {
  it('renders search results and calls onAdd when an in-stock result is tapped', async () => {
    const onAdd = jest.fn();
    const hit = {
      id: 'p1',
      name: 'Matcha Latte',
      price: 4.2,
      inStock: true,
      sku: 'ML-1',
      source: 'local' as const,
      originalProduct: null,
    };
    const tree = await renderUi(<SearchResults results={[hit]} isSearching={false} query="matcha" onAdd={onAdd} />);
    expect(hasText(tree, 'Matcha Latte')).toBe(true);

    await pressByText(tree, 'Matcha Latte');
    expect(onAdd).toHaveBeenCalledWith(hit);
  });
});
