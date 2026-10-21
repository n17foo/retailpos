import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { SquareSettingsForm } from './SquareSettingsForm';
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
  square: { applicationId: 'app-1', locationId: 'loc-1', accessToken: 'tok' },
  adyen: { apiKey: '', clientKey: '', environment: 'test', merchantAccount: '' },
  tap_payments: { apiKey: '', publishableKey: '', merchantId: '' },
  instore_api: { provider: '', terminalId: '', pedDeviceId: '', currency: '', useWebSocket: true },
});

const baseProps = {
  paymentSettings: makeSettings(PaymentProvider.SQUARE),
  isLoading: false,
  onSettingChange: jest.fn(),
};

describe('SquareSettingsForm', () => {
  it('renders nothing for a different provider', async () => {
    const tree = await renderUi(<SquareSettingsForm {...baseProps} paymentSettings={makeSettings(PaymentProvider.STRIPE)} />);
    expect(hasText(tree, 'settings.payment.squareSettings')).toBe(false);
  });

  it('renders fields and fires onSettingChange', async () => {
    const onSettingChange = jest.fn();
    const tree = await renderUi(<SquareSettingsForm {...baseProps} onSettingChange={onSettingChange} />);
    expect(hasText(tree, 'settings.payment.squareSettings')).toBe(true);
    const inputs = tree.root.findAll(n => n.type === 'TextInput');
    expect(inputs).toHaveLength(3);
    inputs[2].props.onChangeText('tok-2');
    expect(onSettingChange).toHaveBeenCalledWith('accessToken', 'tok-2');
  });
});
