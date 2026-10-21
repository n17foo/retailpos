import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { TapPaymentsSettingsForm } from './TapPaymentsSettingsForm';
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
  adyen: { apiKey: '', clientKey: '', environment: 'test', merchantAccount: '' },
  tap_payments: { apiKey: 'sk', publishableKey: 'pk', merchantId: 'merch' },
  instore_api: { provider: '', terminalId: '', pedDeviceId: '', currency: '', useWebSocket: true },
});

const baseProps = {
  paymentSettings: makeSettings(PaymentProvider.TAP_PAYMENTS),
  isLoading: false,
  onSettingChange: jest.fn(),
};

describe('TapPaymentsSettingsForm', () => {
  it('renders nothing for a different provider', async () => {
    const tree = await renderUi(<TapPaymentsSettingsForm {...baseProps} paymentSettings={makeSettings(PaymentProvider.STRIPE)} />);
    expect(hasText(tree, 'settings.payment.tapPaymentsSettings')).toBe(false);
  });

  it('renders fields and fires onSettingChange', async () => {
    const onSettingChange = jest.fn();
    const tree = await renderUi(<TapPaymentsSettingsForm {...baseProps} onSettingChange={onSettingChange} />);
    expect(hasText(tree, 'settings.payment.tapPaymentsSettings')).toBe(true);
    const inputs = tree.root.findAll(n => n.type === 'TextInput');
    expect(inputs).toHaveLength(3);
    inputs[2].props.onChangeText('merch-2');
    expect(onSettingChange).toHaveBeenCalledWith('merchantId', 'merch-2');
  });
});
