import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { OfflineStoreDetailsSection } from './OfflineStoreDetailsSection';

const baseProps = {
  storeName: '',
  storeAddress: '',
  currency: 'GBP',
  onStoreNameChange: jest.fn(),
  onStoreAddressChange: jest.fn(),
  onCurrencyChange: jest.fn(),
};

describe('OfflineStoreDetailsSection', () => {
  it('renders store name, address and currency chips', async () => {
    const tree = await renderUi(<OfflineStoreDetailsSection {...baseProps} />);
    expect(hasText(tree, 'Store Details')).toBe(true);
    expect(hasText(tree, 'Store Name *')).toBe(true);
    expect(hasText(tree, '£ GBP')).toBe(true);
    expect(hasText(tree, '$ USD')).toBe(true);
  });

  it('fires the change callbacks', async () => {
    const onStoreNameChange = jest.fn();
    const onCurrencyChange = jest.fn();
    const tree = await renderUi(
      <OfflineStoreDetailsSection {...baseProps} onStoreNameChange={onStoreNameChange} onCurrencyChange={onCurrencyChange} />
    );
    const nameInput = tree.root.findAll(n => n.type === 'TextInput')[0];
    nameInput.props.onChangeText('My Shop');
    expect(onStoreNameChange).toHaveBeenCalledWith('My Shop');
    await pressByText(tree, '$ USD');
    expect(onCurrencyChange).toHaveBeenCalledWith('USD');
  });
});
