import React from 'react';
import { Alert } from 'react-native';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import PlatformConfigurationStep from './PlatformConfigurationStep';

describe('PlatformConfigurationStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates required platform credentials before completing', async () => {
    const onComplete = jest.fn();
    const setConfig = jest.fn();

    const emptyTree = await renderUi(
      <PlatformConfigurationStep platformId="shopify" config={{}} setConfig={setConfig} onBack={jest.fn()} onComplete={onComplete} />
    );
    expect(hasText(emptyTree, 'Configure Shopify')).toBe(true);

    await pressByText(emptyTree, 'Finish Setup');
    expect(Alert.alert).toHaveBeenCalledWith('Validation Error', expect.any(String));
    expect(onComplete).not.toHaveBeenCalled();

    const validTree = await renderUi(
      <PlatformConfigurationStep
        platformId="shopify"
        config={{ storeUrl: 'shop.myshopify.com', accessToken: 'shpat_123' }}
        setConfig={setConfig}
        onBack={jest.fn()}
        onComplete={onComplete}
      />
    );
    await pressByText(validTree, 'Finish Setup');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
