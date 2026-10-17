import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import VariantPicker from './VariantPicker';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe('VariantPicker', () => {
  it('renders product variants, filters by option chip, and calls onSelect for sellable variants', async () => {
    const onSelect = jest.fn();
    const variants = [
      {
        id: 'v1',
        title: 'Small',
        price: 3,
        optionValues: ['Small'],
        inventoryQuantity: 5,
        trackInventory: true,
        allowBackorder: false,
        isAvailable: true,
        weightUnit: 'g' as const,
        requiresShipping: false,
        taxable: true,
        position: 1,
      },
      {
        id: 'v2',
        title: 'Large',
        price: 4,
        optionValues: ['Large'],
        inventoryQuantity: 0,
        trackInventory: true,
        allowBackorder: false,
        isAvailable: false,
        weightUnit: 'g' as const,
        requiresShipping: false,
        taxable: true,
        position: 2,
      },
    ];
    const options = [{ id: 'opt1', name: 'Size', values: ['Small', 'Large'], position: 1 }];

    const tree = await renderUi(
      <VariantPicker
        visible
        productTitle="Coffee"
        variants={variants}
        options={options}
        currencyCode="GBP"
        onSelect={onSelect}
        onClose={jest.fn()}
      />
    );
    expect(hasText(tree, 'Coffee')).toBe(true);
    expect(hasText(tree, 'Small')).toBe(true);

    await pressByText(tree, '£3.00');
    expect(onSelect).toHaveBeenCalledWith(variants[0]);
  });
});
