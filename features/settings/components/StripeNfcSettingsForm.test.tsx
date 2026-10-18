import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { StripeNfcSettingsForm } from './StripeNfcSettingsForm';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import type { PaymentSettings } from '../../payments/hooks/usePaymentSettings';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

const makeSettings = (provider: PaymentProvider): PaymentSettings => ({
  provider,
  syncInventory: false,
  stripe_nfc: {
    apiKey: 'sk_test',
    publishableKey: 'pk_test',
    merchantId: 'loc-1',
    enableNfc: false,
    backendUrl: 'https://api.example',
    useDirectApi: false,
    useSimulatedReader: true,
    connectionTimeout: '30',
  },
  stripe: { apiKey: '', publishableKey: '', secretKey: '', locationId: '' },
  square: { applicationId: '', locationId: '', accessToken: '' },
  adyen: { apiKey: '', clientKey: '', environment: 'test', merchantAccount: '' },
  tap_payments: { apiKey: '', publishableKey: '', merchantId: '' },
});

const baseProps = {
  paymentSettings: makeSettings(PaymentProvider.STRIPE_NFC),
  isLoading: false,
  onSettingChange: jest.fn(),
  onSaveAndTest: jest.fn(),
};

describe('StripeNfcSettingsForm', () => {
  it('renders nothing for a different provider', async () => {
    const tree = await renderUi(<StripeNfcSettingsForm {...baseProps} paymentSettings={makeSettings(PaymentProvider.SQUARE)} />);
    expect(hasText(tree, 'settings.payment.stripeNfcSettings')).toBe(false);
  });

  it('renders the credential fields and toggles', async () => {
    const tree = await renderUi(<StripeNfcSettingsForm {...baseProps} />);
    expect(hasText(tree, 'settings.payment.stripeNfcSettings')).toBe(true);
    expect(hasText(tree, 'settings.payment.apiKey')).toBe(true);
    expect(hasText(tree, 'settings.payment.enableNfcReader')).toBe(true);
    expect(hasText(tree, 'settings.payment.useSimulatedReader')).toBe(true);
    expect(hasText(tree, 'settings.payment.testTerminalConnection')).toBe(true);
  });

  it('fires onSettingChange for text inputs and toggles', async () => {
    const onSettingChange = jest.fn();
    const tree = await renderUi(<StripeNfcSettingsForm {...baseProps} onSettingChange={onSettingChange} />);
    const inputs = tree.root.findAll(n => n.type === 'TextInput');
    inputs[0].props.onChangeText('sk_new');
    expect(onSettingChange).toHaveBeenCalledWith('apiKey', 'sk_new');
    const pressables = tree.root.findAll(n => n.type === 'TouchableOpacity' && n.props.onPress);
    pressables[0].props.onPress();
    expect(onSettingChange).toHaveBeenCalledWith('enableNfc', true);
    pressables[1].props.onPress();
    expect(onSettingChange).toHaveBeenCalledWith('useSimulatedReader', false);
    pressables[2].props.onPress();
  });

  it('fires onSaveAndTest', async () => {
    const onSaveAndTest = jest.fn();
    const tree = await renderUi(<StripeNfcSettingsForm {...baseProps} onSaveAndTest={onSaveAndTest} />);
    const pressables = tree.root.findAll(n => n.type === 'TouchableOpacity' && n.props.onPress);
    pressables[2].props.onPress();
    expect(onSaveAndTest).toHaveBeenCalledTimes(1);
  });
});
