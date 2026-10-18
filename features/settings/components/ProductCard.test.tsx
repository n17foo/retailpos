import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ProductCard } from './ProductCard';
import type { Product } from '../../catalogue/hooks/useOfflineProducts';

const product: Product = {
  id: 'p1',
  title: 'Iced Latte',
  productType: 'Drinks',
  variants: [{ id: 'v1', price: 2.99, sku: 'ICL-01', inventoryQuantity: 12 }],
};

const baseProps = {
  product,
  currencyCode: 'USD',
  onEdit: jest.fn(),
  onDelete: jest.fn(),
};

describe('ProductCard', () => {
  it('renders title, price, SKU, stock and category', async () => {
    const tree = await renderUi(<ProductCard {...baseProps} />);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
    expect(hasText(tree, '$2.99')).toBe(true);
    expect(hasText(tree, 'SKU: ICL-01')).toBe(true);
    expect(hasText(tree, 'Stock: 12')).toBe(true);
    expect(hasText(tree, 'Drinks')).toBe(true);
    expect(hasText(tree, 'No Image')).toBe(true);
  });

  it('fires onEdit and onDelete with the product', async () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const tree = await renderUi(<ProductCard {...baseProps} onEdit={onEdit} onDelete={onDelete} />);
    await pressByText(tree, 'Edit');
    expect(onEdit).toHaveBeenCalledWith(product);
    await pressByText(tree, 'Delete');
    expect(onDelete).toHaveBeenCalledWith(product);
  });
});
