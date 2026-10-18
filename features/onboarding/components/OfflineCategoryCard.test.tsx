import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { OfflineCategoryCard } from './OfflineCategoryCard';
import type { OfflineCategory } from '../screens/OfflineSetupStep';

const category: OfflineCategory = {
  id: 'cat-1',
  name: 'Drinks',
  products: [{ id: 'p1', name: 'Iced Latte', price: '2.99', sku: 'ICL-01' }],
};

const baseProps = {
  category,
  isExpanded: true,
  currency: 'USD',
  newProductName: '',
  newProductPrice: '',
  newProductSku: '',
  onToggleExpand: jest.fn(),
  onRemoveCategory: jest.fn(),
  onRemoveProduct: jest.fn(),
  onAddProduct: jest.fn(),
  onNewProductNameChange: jest.fn(),
  onNewProductPriceChange: jest.fn(),
  onNewProductSkuChange: jest.fn(),
};

describe('OfflineCategoryCard', () => {
  it('renders the category header and expanded product list', async () => {
    const tree = await renderUi(<OfflineCategoryCard {...baseProps} />);
    expect(hasText(tree, 'Drinks')).toBe(true);
    expect(hasText(tree, '(1)')).toBe(true);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
    expect(hasText(tree, '$ 2.99')).toBe(true);
    expect(hasText(tree, 'SKU: ICL-01')).toBe(true);
  });

  it('hides the product list when collapsed', async () => {
    const tree = await renderUi(<OfflineCategoryCard {...baseProps} isExpanded={false} />);
    expect(hasText(tree, 'Iced Latte')).toBe(false);
    expect(hasText(tree, '+ Add Product')).toBe(false);
  });

  it('fires the header and action callbacks', async () => {
    const onToggleExpand = jest.fn();
    const onRemoveCategory = jest.fn();
    const onRemoveProduct = jest.fn();
    const onAddProduct = jest.fn();
    const tree = await renderUi(
      <OfflineCategoryCard
        {...baseProps}
        onToggleExpand={onToggleExpand}
        onRemoveCategory={onRemoveCategory}
        onRemoveProduct={onRemoveProduct}
        onAddProduct={onAddProduct}
      />
    );
    await pressByText(tree, 'Drinks');
    expect(onToggleExpand).toHaveBeenCalledWith('cat-1');
    await pressByText(tree, 'Remove');
    expect(onRemoveCategory).toHaveBeenCalledWith('cat-1');
    await pressByText(tree, '✕');
    expect(onRemoveProduct).toHaveBeenCalledWith('cat-1', 'p1');
    await pressByText(tree, '+ Add Product');
    expect(onAddProduct).toHaveBeenCalledWith('cat-1');
  });
});
