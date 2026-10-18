import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import type { PaymentSettings } from '../../payments/hooks/usePaymentSettings';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { paymentSettingsStyles as styles } from './paymentSettingsStyles';

interface SquareSettingsFormProps {
  paymentSettings: PaymentSettings;
  isLoading: boolean;
  onSettingChange: (field: string, value: string) => void;
}

/** Square provider fields — application ID, location ID, access token. */
export const SquareSettingsForm: React.FC<SquareSettingsFormProps> = ({ paymentSettings, isLoading, onSettingChange }) => {
  const { t } = useTranslate();
  if (paymentSettings.provider !== PaymentProvider.SQUARE) return null;
  const s = paymentSettings.square;

  return (
    <View style={styles.settingGroup}>
      <Text style={styles.settingLabel}>{t('settings.payment.squareSettings')}</Text>
      <View style={styles.inputGroup}>
        <TextInput
          style={styles.input}
          value={s.applicationId}
          onChangeText={v => onSettingChange('applicationId', v)}
          placeholder={t('settings.payment.applicationId')}
          editable={!isLoading}
        />
      </View>
      <View style={styles.inputGroup}>
        <TextInput
          style={styles.input}
          value={s.locationId}
          onChangeText={v => onSettingChange('locationId', v)}
          placeholder={t('settings.payment.locationId')}
          editable={!isLoading}
        />
      </View>
      <View style={styles.inputGroup}>
        <TextInput
          style={styles.input}
          value={s.accessToken}
          onChangeText={v => onSettingChange('accessToken', v)}
          placeholder={t('settings.payment.accessToken')}
          secureTextEntry
          editable={!isLoading}
        />
      </View>
    </View>
  );
};
