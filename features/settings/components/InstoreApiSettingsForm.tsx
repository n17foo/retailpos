import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import type { PaymentSettings } from '../../payments/hooks/usePaymentSettings';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';
import { paymentSettingsStyles as styles } from './paymentSettingsStyles';

/** Server-side PED providers the store-api orchestrator can drive (ADR-015). */
const PED_PROVIDERS = ['worldpay', 'worldline', 'globalpayments', 'nexi', 'elavon', 'fiserv', 'adyen'] as const;

interface InstoreApiSettingsFormProps {
  paymentSettings: PaymentSettings;
  isLoading: boolean;
  onSettingChange: (field: string, value: string | boolean) => void;
}

/** Instore PED fields — provider, terminal ID, PED device ID, currency. */
export const InstoreApiSettingsForm: React.FC<InstoreApiSettingsFormProps> = ({ paymentSettings, isLoading, onSettingChange }) => {
  const { t } = useTranslate();
  if (paymentSettings.provider !== PaymentProvider.INSTORE_API) return null;
  const s = paymentSettings.instore_api;

  return (
    <View style={styles.settingGroup}>
      <Text style={styles.settingLabel}>{t('settings.payment.instoreApiSettings', { defaultValue: 'Instore PED Settings' })}</Text>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.instoreApiProvider', { defaultValue: 'PED Provider' })}</Text>
        <View style={styles.radioGroup}>
          {PED_PROVIDERS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.radioButton, s.provider === p && styles.radioButtonSelected]}
              onPress={() => onSettingChange('provider', p)}
              disabled={isLoading}
            >
              <View style={[styles.radioButtonOuter, s.provider === p && styles.radioButtonOuterSelected]}>
                {s.provider === p && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={styles.radioButtonLabel}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.instoreApiTerminalId', { defaultValue: 'Terminal ID' })}</Text>
        <TextInput
          style={styles.input}
          value={s.terminalId}
          onChangeText={v => onSettingChange('terminalId', v)}
          placeholder="TERM-01"
          editable={!isLoading}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.instoreApiPedDeviceId', { defaultValue: 'PED Device ID (defaults to this register)' })}</Text>
        <TextInput
          style={styles.input}
          value={s.pedDeviceId}
          onChangeText={v => onSettingChange('pedDeviceId', v)}
          placeholder={instoreApiConfig.current.registerId || 'register-01'}
          editable={!isLoading}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.instoreApiCurrency', { defaultValue: 'Currency (ISO code)' })}</Text>
        <TextInput
          style={styles.input}
          value={s.currency}
          onChangeText={v => onSettingChange('currency', v)}
          placeholder="GBP"
          editable={!isLoading}
          autoCapitalize="characters"
          maxLength={3}
        />
      </View>
    </View>
  );
};
