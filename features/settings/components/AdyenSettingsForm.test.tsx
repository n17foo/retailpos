import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { AdyenSettingsForm } from './AdyenSettingsForm';
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
  stripe: { apiKey: '', publishableKey: '', secretKey: '', locationId: '' },
  square: { applicationId: '', locationId: '', accessToken: '' },
  adyen: { apiKey: 'AQE', clientKey: 'ck', environment: 'test', merchantAccount: 'acct' },
  tap_payments: { apiKey: '', publishableKey: '', merchantId: '' },
  instore_api: { provider: '', terminalId: '', pedDeviceId: '', currency: '', useWebSocket: true },
});

const baseProps = {
  paymentSettings: makeSettings(PaymentProvider.ADYEN),
  isLoading: false,
  onSettingChange: jest.fn(),
};

describe('AdyenSettingsForm', () => {
  it('renders nothing for a different provider', async () => {
    const tree = await renderUi(<AdyenSettingsForm {...baseProps} paymentSettings={makeSettings(PaymentProvider.SQUARE)} />);
    expect(hasText(tree, 'settings.payment.adyenSettings')).toBe(false);
  });

  it('renders fields and environment radio options', async () => {
    const tree = await renderUi(<AdyenSettingsForm {...baseProps} />);
    expect(hasText(tree, 'settings.payment.adyenSettings')).toBe(true);
    expect(hasText(tree, 'Test')).toBe(true);
    expect(hasText(tree, 'Live')).toBe(true);
  });

  it('fires onSettingChange for the environment radio and inputs', async () => {
    const onSettingChange = jest.fn();
    const tree = await renderUi(<AdyenSettingsForm {...baseProps} onSettingChange={onSettingChange} />);
    await pressByText(tree, 'Live');
    expect(onSettingChange).toHaveBeenCalledWith('environment', 'live');
    const inputs = tree.root.findAll(n => n.type === 'TextInput');
    inputs[2].props.onChangeText('acct-2');
    expect(onSettingChange).toHaveBeenCalledWith('merchantAccount', 'acct-2');
  });
});
