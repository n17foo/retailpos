import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import OnboardingScreen from './OnboardingScreen';

const mockSetIsOnboarded = jest.fn();
jest.mock('../contexts/OnboardingProvider', () => ({
  useOnboardingContext: () => ({ setIsOnboarded: mockSetIsOnboarded }),
}));

jest.mock('../../platform-clients/hooks/useEcommerceSettings', () => ({
  useEcommerceSettings: () => ({
    saveSettings: jest.fn().mockResolvedValue(true),
    updateSettings: jest.fn(),
  }),
}));

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('../services/SetupProgressService', () => ({
  setupProgressService: {
    completePhase: jest.fn().mockResolvedValue(undefined),
    markOnboardingComplete: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../platform-clients/services/platform/PlatformCapabilityService', () => ({
  platformCapabilityService: {
    setPlatform: jest.fn(),
    getCapabilities: () => ({
      discounts: 'supported',
      giftCards: 'unsupported',
      refunds: 'supported',
      loyalty: 'unsupported',
      storeCredit: 'unsupported',
    }),
  },
}));

jest.mock('./PlatformSelectionStep', () => {
  const R = require('react');
  return ({ onSelectPlatform }: { onSelectPlatform: (id: string) => void }) =>
    R.createElement(
      'Button',
      { title: 'PickShopify', onPress: () => onSelectPlatform('shopify') },
      R.createElement('Text', null, 'PickShopify')
    );
});

jest.mock('./PlatformConfigurationStep', () => {
  const R = require('react');
  return ({ onComplete }: { onComplete: () => void }) =>
    R.createElement(
      'Button',
      { title: 'FinishPlatformConfig', onPress: onComplete },
      R.createElement('Text', null, 'FinishPlatformConfig')
    );
});

jest.mock('./AdminUserStep', () => {
  const R = require('react');
  return ({ onComplete }: { onComplete: () => void }) =>
    R.createElement('Button', { title: 'FinishAdminUser', onPress: onComplete }, R.createElement('Text', null, 'FinishAdminUser'));
});

jest.mock('./PaymentProviderStep', () => {
  const R = require('react');
  return ({ onNext }: { onNext: () => void }) =>
    R.createElement('Button', { title: 'FinishPaymentStep', onPress: onNext }, R.createElement('Text', null, 'FinishPaymentStep'));
});

jest.mock('./PrinterSetupStep', () => {
  const R = require('react');
  return ({ onSkip }: { onSkip: () => void }) =>
    R.createElement('Button', { title: 'SkipPrinterStep', onPress: onSkip }, R.createElement('Text', null, 'SkipPrinterStep'));
});

jest.mock('./ScannerSetupStep', () => {
  const R = require('react');
  return ({ onComplete }: { onComplete: () => void }) =>
    R.createElement('Button', { title: 'FinishScannerStep', onPress: onComplete }, R.createElement('Text', null, 'FinishScannerStep'));
});

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('progresses through Phase 1 (platform), Phase 2 (admin), and Phase 3 (peripherals) to completion', async () => {
    const tree = await renderUi(<OnboardingScreen />);
    expect(hasText(tree, 'PickShopify')).toBe(true);

    await pressByText(tree, 'PickShopify');
    expect(hasText(tree, 'FinishPlatformConfig')).toBe(true);

    await pressByText(tree, 'FinishPlatformConfig');
    expect(hasText(tree, 'FinishAdminUser')).toBe(true);

    await pressByText(tree, 'FinishAdminUser');
    expect(hasText(tree, 'FinishPaymentStep')).toBe(true);

    await pressByText(tree, 'FinishPaymentStep');
    expect(hasText(tree, 'SkipPrinterStep')).toBe(true);

    await pressByText(tree, 'SkipPrinterStep');
    expect(hasText(tree, 'FinishScannerStep')).toBe(true);

    await pressByText(tree, 'FinishScannerStep');
    expect(mockSetIsOnboarded).toHaveBeenCalledWith(true);
  });
});
