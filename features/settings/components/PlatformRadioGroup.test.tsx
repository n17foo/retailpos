import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { PlatformRadioGroup } from './PlatformRadioGroup';

describe('PlatformRadioGroup', () => {
  it('renders all platform options', async () => {
    const tree = await renderUi(<PlatformRadioGroup selected="shopify" onSelect={jest.fn()} />);
    expect(hasText(tree, 'Shopify')).toBe(true);
    expect(hasText(tree, 'WooCommerce')).toBe(true);
    expect(hasText(tree, 'Offline')).toBe(true);
  });

  it('fires onSelect when a label is pressed', async () => {
    const onSelect = jest.fn();
    const tree = await renderUi(<PlatformRadioGroup selected="shopify" onSelect={onSelect} />);
    await pressByText(tree, 'WooCommerce');
    expect(onSelect).toHaveBeenCalledWith('woocommerce');
  });
});
