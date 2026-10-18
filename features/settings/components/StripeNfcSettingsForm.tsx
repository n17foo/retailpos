import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { spacing } from '../../../shared/utils/theme';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import type { PaymentSettings } from '../../payments/hooks/usePaymentSettings';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { paymentSettingsStyles as styles } from './paymentSettingsStyles';

interface StripeNfcSettingsFormProps {
  paymentSettings: PaymentSettings;
  isLoading: boolean;
  onSettingChange: (field: string, value: string | boolean) => void;
  onSaveAndTest: () => void;
}

/** Stripe NFC (Tap to Pay) provider fields — keys, location, backend URL, reader toggles. */
export const StripeNfcSettingsForm: React.FC<StripeNfcSettingsFormProps> = ({
  paymentSettings,
  isLoading,
  onSettingChange,
  onSaveAndTest,
}) => {
  const { t } = useTranslate();
  if (paymentSettings.provider !== PaymentProvider.STRIPE_NFC) return null;
  const s = paymentSettings.stripe_nfc;

  return (
    <View style={styles.settingGroup}>
      <Text style={styles.settingLabel}>{t('settings.payment.stripeNfcSettings')}</Text>

      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.apiKey')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('settings.payment.stripeApiKeyNfcPlaceholder')}
          value={s.apiKey}
          onChangeText={v => onSettingChange('apiKey', v)}
          editable={!isLoading}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.publishableKey')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('settings.payment.publishableKeyPlaceholder')}
          value={s.publishableKey ?? ''}
          onChangeText={v => onSettingChange('publishableKey', v)}
          editable={!isLoading}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.locationId')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('settings.payment.stripeLocationPlaceholder')}
          value={s.merchantId}
          onChangeText={v => onSettingChange('merchantId', v)}
          editable={!isLoading}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text>{t('settings.payment.backendUrl')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('settings.payment.backendUrlPlaceholder')}
          value={s.backendUrl}
          onChangeText={v => onSettingChange('backendUrl', v)}
          editable={!isLoading}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.optionRow}>
        <Text style={styles.label}>{t('settings.payment.enableNfcReader')}</Text>
        <TouchableOpacity
          style={[styles.toggleButton, s.enableNfc ? styles.toggleActive : styles.toggleInactive, isLoading && styles.disabled]}
          onPress={() => onSettingChange('enableNfc', !s.enableNfc)}
          disabled={isLoading}
        >
          <Text style={styles.toggleText}>{s.enableNfc ? t('settings.payment.on') : t('settings.payment.off')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.optionRow}>
        <Text style={styles.label}>{t('settings.payment.useSimulatedReader')}</Text>
        <TouchableOpacity
          style={[styles.toggleButton, s.useSimulatedReader ? styles.toggleActive : styles.toggleInactive, isLoading && styles.disabled]}
          onPress={() => onSettingChange('useSimulatedReader', !s.useSimulatedReader)}
          disabled={isLoading}
        >
          <Text style={styles.toggleText}>{s.useSimulatedReader ? t('settings.payment.on') : t('settings.payment.off')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.verticalButton, styles.testButton, isLoading && styles.buttonDisabled, { marginTop: spacing.md }]}
        onPress={onSaveAndTest}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>{t('settings.payment.testTerminalConnection')}</Text>
      </TouchableOpacity>
    </View>
  );
};
