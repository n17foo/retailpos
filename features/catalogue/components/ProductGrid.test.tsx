import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ProductGrid } from './ProductGrid';
import { getSaleLayout } from '../../../shared/utils/responsive.utils';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

describe('ProductGrid', () => {
  it('renders product cards and invokes onAdd when a single-variant product is tapped', async () => {
    const onAdd = jest.fn();
    const product = {
      id: 'p1',
      name: 'Americano',
      price: 3,
      image: null,
      isEcommerceProduct: false,
      sellable: true,
      stock: 10,
    };

    const tree = await renderUi(<ProductGrid products={[product]} onAdd={onAdd} layout={getSaleLayout(1024, 768)} density="large" />);
    expect(hasText(tree, 'Americano')).toBe(true);

    await pressByText(tree, 'Americano');
    expect(onAdd).toHaveBeenCalledWith(product);
  });
});
