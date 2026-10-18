import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import type { PaymentSettings } from '../../payments/hooks/usePaymentSettings';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { paymentSettingsStyles as styles } from './paymentSettingsStyles';

interface AdyenSettingsFormProps {
  paymentSettings: PaymentSettings;
  isLoading: boolean;
  onSettingChange: (field: string, value: string) => void;
}

/** Adyen provider fields — API key, client key, merchant account, environment. */
export const AdyenSettingsForm: React.FC<AdyenSettingsFormProps> = ({ paymentSettings, isLoading, onSettingChange }) => {
  const { t } = useTranslate();
  if (paymentSettings.provider !== PaymentProvider.ADYEN) return null;
  const s = paymentSettings.adyen;

  return (
    <View style={styles.settingGroup}>
      <Text style={styles.settingLabel}>{t('settings.payment.adyenSettings', { defaultValue: 'Adyen Settings' })}</Text>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.apiKey')}</Text>
        <TextInput
          style={styles.input}
          value={s.apiKey}
          onChangeText={v => onSettingChange('apiKey', v)}
          placeholder="AQE..."
          secureTextEntry
          editable={!isLoading}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.publishableKey', { defaultValue: 'Client Key' })}</Text>
        <TextInput
          style={styles.input}
          value={s.clientKey}
          onChangeText={v => onSettingChange('clientKey', v)}
          placeholder="test_..."
          editable={!isLoading}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.merchantAccount', { defaultValue: 'Merchant Account' })}</Text>
        <TextInput
          style={styles.input}
          value={s.merchantAccount}
          onChangeText={v => onSettingChange('merchantAccount', v)}
          placeholder="YourMerchantAccount"
          editable={!isLoading}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.optionRow}>
        <Text style={styles.label}>{t('settings.payment.environment', { defaultValue: 'Environment' })}</Text>
        <View style={styles.radioGroup}>
          {(['test', 'live'] as const).map(env => (
            <TouchableOpacity
              key={env}
              style={[styles.radioButton, s.environment === env && styles.radioButtonSelected]}
              onPress={() => onSettingChange('environment', env)}
              disabled={isLoading}
            >
              <View style={[styles.radioButtonOuter, s.environment === env && styles.radioButtonOuterSelected]}>
                {s.environment === env && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={styles.radioButtonLabel}>{env.charAt(0).toUpperCase() + env.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};
