import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import type { PaymentSettings } from '../../payments/hooks/usePaymentSettings';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { paymentSettingsStyles as styles } from './paymentSettingsStyles';

interface TapPaymentsSettingsFormProps {
  paymentSettings: PaymentSettings;
  isLoading: boolean;
  onSettingChange: (field: string, value: string) => void;
}

/** Tap Payments provider fields — API key, publishable key, merchant ID. */
export const TapPaymentsSettingsForm: React.FC<TapPaymentsSettingsFormProps> = ({ paymentSettings, isLoading, onSettingChange }) => {
  const { t } = useTranslate();
  if (paymentSettings.provider !== PaymentProvider.TAP_PAYMENTS) return null;
  const s = paymentSettings.tap_payments;

  return (
    <View style={styles.settingGroup}>
      <Text style={styles.settingLabel}>{t('settings.payment.tapPaymentsSettings', { defaultValue: 'Tap Payments Settings' })}</Text>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.apiKey')}</Text>
        <TextInput
          style={styles.input}
          value={s.apiKey}
          onChangeText={v => onSettingChange('apiKey', v)}
          placeholder="sk_..."
          secureTextEntry
          editable={!isLoading}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.publishableKey')}</Text>
        <TextInput
          style={styles.input}
          value={s.publishableKey}
          onChangeText={v => onSettingChange('publishableKey', v)}
          placeholder="pk_..."
          editable={!isLoading}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.merchantId', { defaultValue: 'Merchant ID' })}</Text>
        <TextInput
          style={styles.input}
          value={s.merchantId}
          onChangeText={v => onSettingChange('merchantId', v)}
          placeholder="merchant_..."
          editable={!isLoading}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
};
