import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import PaymentProviderStep from './PaymentProviderStep';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';

const mockSaveSettings = jest.fn().mockResolvedValue(true);

jest.mock('../../payments/hooks/usePaymentSettings', () => ({
  usePaymentSettings: () => ({
    paymentSettings: {
      provider: PaymentProvider.STRIPE_NFC,
      syncInventory: false,
      stripe_nfc: { apiKey: 'sk_test_1', publishableKey: 'pk_test_1', merchantId: 'loc_1', enableNfc: true, backendUrl: '' },
      stripe: { publishableKey: '', secretKey: '' },
      square: { applicationId: '', locationId: '', accessToken: '' },
      adyen: { apiKey: '', clientKey: '', environment: 'test', merchantAccount: '' },
      tap_payments: { apiKey: '', publishableKey: '', merchantId: '' },
    },
    handlePaymentSettingsChange: jest.fn(),
    saveSettings: mockSaveSettings,
    isLoading: false,
    loadSettings: jest.fn(),
    testConnection: jest.fn().mockResolvedValue(true),
  }),
}));

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe('PaymentProviderStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders payment provider options and saves valid settings on Next', async () => {
    const onNext = jest.fn();
    const tree = await renderUi(<PaymentProviderStep onBack={jest.fn()} onNext={onNext} />);
    expect(hasText(tree, 'Stripe NFC (Tap to Pay)')).toBe(true);

    await pressByText(tree, 'common.next');
    expect(mockSaveSettings).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
