import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { paymentSettingsStyles as styles } from './paymentSettingsStyles';

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  [PaymentProvider.STRIPE_NFC]: 'Stripe NFC (Tap to Pay)',
  [PaymentProvider.STRIPE]: 'Stripe Terminal',
  [PaymentProvider.SQUARE]: 'Square',
  [PaymentProvider.ADYEN]: 'Adyen',
  [PaymentProvider.TAP_PAYMENTS]: 'Tap Payments',
  [PaymentProvider.INSTORE_API]: 'Instore PED',
};

interface PaymentProviderSelectorProps {
  selected: PaymentProvider;
  isLoading: boolean;
  onSelect: (provider: PaymentProvider) => void;
}

/** Radio group for choosing the active payment provider. */
export const PaymentProviderSelector: React.FC<PaymentProviderSelectorProps> = ({ selected, isLoading, onSelect }) => {
  const { t } = useTranslate();
  return (
    <View style={styles.settingGroup}>
      <Text style={styles.settingLabel}>{t('settings.payment.provider')}</Text>
      <View style={styles.radioGroup}>
        {Object.values(PaymentProvider).map(provider => (
          <TouchableOpacity
            key={provider}
            style={[styles.radioButton, selected === provider && styles.radioButtonSelected]}
            onPress={() => onSelect(provider)}
            disabled={isLoading}
          >
            <View style={[styles.radioButtonOuter, selected === provider && styles.radioButtonOuterSelected]}>
              {selected === provider && <View style={styles.radioButtonInner} />}
            </View>
            <Text style={styles.radioButtonLabel}>{PAYMENT_PROVIDER_LABELS[provider]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
