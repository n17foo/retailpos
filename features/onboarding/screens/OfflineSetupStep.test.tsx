import React from 'react';
import { Alert } from 'react-native';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import OfflineSetupStep, { OfflineStoreConfig } from './OfflineSetupStep';

describe('OfflineSetupStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates store name, categories, and products before calling onComplete', async () => {
    const onComplete = jest.fn();
    const emptyConfig: OfflineStoreConfig = { storeName: '', storeAddress: '', categories: [], currency: 'GBP' };

    const emptyTree = await renderUi(
      <OfflineSetupStep config={emptyConfig} setConfig={jest.fn()} onBack={jest.fn()} onComplete={onComplete} />
    );
    expect(hasText(emptyTree, 'Set Up Your Store')).toBe(true);

    await pressByText(emptyTree, 'Continue');
    expect(Alert.alert).toHaveBeenCalledWith('Validation', 'Please enter your store name.');
    expect(onComplete).not.toHaveBeenCalled();

    const validConfig: OfflineStoreConfig = {
      storeName: 'Corner Café',
      storeAddress: '1 High St',
      currency: 'GBP',
      categories: [{ id: 'c1', name: 'Coffee', products: [{ id: 'p1', name: 'Latte', price: '3.50' }] }],
    };
    const validTree = await renderUi(
      <OfflineSetupStep config={validConfig} setConfig={jest.fn()} onBack={jest.fn()} onComplete={onComplete} />
    );
    await pressByText(validTree, 'Continue');
    expect(onComplete).toHaveBeenCalledWith(validConfig);
  });
});
