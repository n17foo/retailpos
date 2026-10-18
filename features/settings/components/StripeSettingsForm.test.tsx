import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { StripeSettingsForm } from './StripeSettingsForm';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import type { PaymentSettings } from '../../payments/hooks/usePaymentSettings';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

const makeSettings = (provider: PaymentProvider): PaymentSettings => ({
  provider,
  syncInventory: false,
  stripe_nfc: {
    apiKey: '',
    publishableKey: '',
    merchantId: '',
    enableNfc: false,
    backendUrl: '',
    useDirectApi: false,
    useSimulatedReader: false,
    connectionTimeout: '30',
  },
  stripe: { apiKey: 'sk', publishableKey: '', secretKey: '', locationId: 'loc-1' },
  square: { applicationId: '', locationId: '', accessToken: '' },
  adyen: { apiKey: '', clientKey: '', environment: 'test', merchantAccount: '' },
  tap_payments: { apiKey: '', publishableKey: '', merchantId: '' },
});

const baseProps = {
  paymentSettings: makeSettings(PaymentProvider.STRIPE),
  isLoading: false,
  onSettingChange: jest.fn(),
};

describe('StripeSettingsForm', () => {
  it('renders nothing for a different provider', async () => {
    const tree = await renderUi(<StripeSettingsForm {...baseProps} paymentSettings={makeSettings(PaymentProvider.SQUARE)} />);
    expect(hasText(tree, 'settings.payment.stripeSettings')).toBe(false);
  });

  it('renders API key and location ID and fires onSettingChange', async () => {
    const onSettingChange = jest.fn();
    const tree = await renderUi(<StripeSettingsForm {...baseProps} onSettingChange={onSettingChange} />);
    expect(hasText(tree, 'settings.payment.stripeSettings')).toBe(true);
    expect(hasText(tree, 'settings.payment.apiKey')).toBe(true);
    expect(hasText(tree, 'settings.payment.locationId')).toBe(true);
    const inputs = tree.root.findAll(n => n.type === 'TextInput');
    inputs[1].props.onChangeText('loc-2');
    expect(onSettingChange).toHaveBeenCalledWith('locationId', 'loc-2');
  });
});
