import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import type { PaymentSettings } from '../../payments/hooks/usePaymentSettings';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { paymentSettingsStyles as styles } from './paymentSettingsStyles';

interface StripeSettingsFormProps {
  paymentSettings: PaymentSettings;
  isLoading: boolean;
  onSettingChange: (field: string, value: string) => void;
}

/** Stripe Terminal provider fields — API key + location ID. */
export const StripeSettingsForm: React.FC<StripeSettingsFormProps> = ({ paymentSettings, isLoading, onSettingChange }) => {
  const { t } = useTranslate();
  if (paymentSettings.provider !== PaymentProvider.STRIPE) return null;
  const s = paymentSettings.stripe;

  return (
    <View style={styles.settingGroup}>
      <Text style={styles.settingLabel}>{t('settings.payment.stripeSettings')}</Text>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.apiKey')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('settings.payment.stripeApiKeyPlaceholder')}
          value={s.apiKey ?? ''}
          onChangeText={v => onSettingChange('apiKey', v)}
          editable={!isLoading}
          secureTextEntry
          autoCapitalize="none"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.locationId')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('settings.payment.stripeLocationPlaceholder')}
          value={s.locationId ?? ''}
          onChangeText={v => onSettingChange('locationId', v)}
          editable={!isLoading}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
};
