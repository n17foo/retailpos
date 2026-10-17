import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import PaymentSettingsTab from './PaymentSettingsTab';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', username: 'Admin', role: 'admin' } }),
}));

const mockLoadSettings = jest.fn().mockResolvedValue(true);
jest.mock('../../payments/hooks/usePaymentSettings', () => ({
  usePaymentSettings: () => ({
    paymentSettings: {
      provider: PaymentProvider.STRIPE_NFC,
      syncInventory: false,
      stripe_nfc: { apiKey: 'sk_test', publishableKey: 'pk_test', merchantId: 'm1', enableNfc: true, backendUrl: '' },
      stripe: { publishableKey: '', secretKey: '' },
      square: { applicationId: '', locationId: '', accessToken: '' },
      adyen: { apiKey: '', clientKey: '', environment: 'test', merchantAccount: '' },
      tap_payments: { apiKey: '', publishableKey: '', merchantId: '' },
    },
    handlePaymentSettingsChange: jest.fn(),
    saveSettings: jest.fn(),
    testConnection: jest.fn(),
    error: null,
    saveStatus: 'saved',
    isLoading: false,
    loadSettings: mockLoadSettings,
  }),
}));

describe('PaymentSettingsTab', () => {
  it('renders payment provider options and active Stripe NFC configuration fields', async () => {
    const tree = await renderUi(<PaymentSettingsTab />);
    expect(hasText(tree, 'Stripe NFC (Tap to Pay)')).toBe(true);
    expect(hasText(tree, 'Square')).toBe(true);
  });
});
