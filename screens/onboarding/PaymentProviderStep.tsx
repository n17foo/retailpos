import React, { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Button, ActivityIndicator, Alert } from 'react-native';
import { usePaymentSettings, PaymentSettings } from '../../hooks/usePaymentSettings';
import { PaymentProvider } from '../../services/payment/PaymentServiceFactory';
import { useTranslate } from '../../hooks/useTranslate';
import { lightColors } from '../../utils/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentProviderStepProps {
  onBack: () => void;
  onNext: () => void;
}

type ProviderSettingKey<T extends keyof PaymentSettings> = keyof PaymentSettings[T];

// Human-readable labels for each provider
const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  [PaymentProvider.STRIPE_NFC]: 'Stripe NFC (Tap to Pay)',
  [PaymentProvider.STRIPE]: 'Stripe Terminal',
  [PaymentProvider.SQUARE]: 'Square',
  [PaymentProvider.ADYEN]: 'Adyen',
  [PaymentProvider.TAP_PAYMENTS]: 'Tap Payments',
  [PaymentProvider.INSTORE_API]: 'Instore PED',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PaymentProviderStep: React.FC<PaymentProviderStepProps> = ({ onBack, onNext }) => {
  const { t } = useTranslate();
  const { paymentSettings, handlePaymentSettingsChange, saveSettings, isLoading, loadSettings, testConnection } = usePaymentSettings();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleProviderChange = useCallback(
    (provider: PaymentProvider) => {
      handlePaymentSettingsChange({ provider });
    },
    [handlePaymentSettingsChange]
  );

  const handleProviderSettingChange = useCallback(
    <T extends keyof PaymentSettings>(provider: T, field: ProviderSettingKey<T>, value: string | boolean) => {
      handlePaymentSettingsChange({
        [provider]: {
          ...(paymentSettings[provider] as object),
          [field]: value,
        },
      } as Partial<PaymentSettings>);
    },
    [handlePaymentSettingsChange, paymentSettings]
  );

  const validateSettings = (): boolean => {
    const { provider, stripe_nfc, stripe, square, adyen, tap_payments } = paymentSettings;
    switch (provider) {
      case PaymentProvider.STRIPE_NFC:
        if (!stripe_nfc?.apiKey || !stripe_nfc?.publishableKey) {
          Alert.alert(t('common.validationError'), t('payment.stripeNfc.required'));
          return false;
        }
        break;
      case PaymentProvider.STRIPE:
        if (!stripe?.apiKey || !stripe?.locationId) {
          Alert.alert(t('common.validationError'), t('payment.stripe.required'));
          return false;
        }
        break;
      case PaymentProvider.SQUARE:
        if (!square?.applicationId) {
          Alert.alert(t('common.validationError'), t('payment.square.applicationIdRequired'));
          return false;
        }
        break;
      case PaymentProvider.ADYEN:
        if (!adyen?.apiKey || !adyen?.merchantAccount) {
          Alert.alert(
            t('common.validationError'),
            t('payment.adyen.required', { defaultValue: 'API Key and Merchant Account are required for Adyen' })
          );
          return false;
        }
        break;
      case PaymentProvider.TAP_PAYMENTS:
        if (!tap_payments?.apiKey || !tap_payments?.merchantId) {
          Alert.alert(
            t('common.validationError'),
            t('payment.tapPayments.required', { defaultValue: 'API Key and Merchant ID are required for Tap Payments' })
          );
          return false;
        }
        break;
    }
    return true;
  };

  const handleNextPress = async () => {
    if (validateSettings()) {
      await saveSettings(paymentSettings);
      onNext();
    }
  };

  const handleTestConnection = async () => {
    const success = await testConnection(paymentSettings.provider);
    Alert.alert(
      success ? t('common.success') : t('common.failure'),
      success ? t('payment.connectionSuccess') : t('payment.connectionFailed')
    );
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderProviderSelection = () => (
    <View style={styles.settingGroup}>
      <Text style={styles.settingLabel}>{t('payment.provider')}</Text>
      <View style={styles.radioGroup}>
        {Object.values(PaymentProvider).map(provider => (
          <TouchableOpacity
            key={provider}
            style={[styles.radioButton, paymentSettings.provider === provider && styles.radioButtonSelected]}
            onPress={() => handleProviderChange(provider)}
          >
            <Text style={paymentSettings.provider === provider ? styles.radioButtonTextSelected : undefined}>
              {PROVIDER_LABELS[provider]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStripeNfcForm = () => {
    if (paymentSettings.provider !== PaymentProvider.STRIPE_NFC) return null;
    const s = paymentSettings.stripe_nfc;
    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>{t('payment.stripeNfc.title')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('payment.stripeNfc.apiKey')}
          value={s.apiKey}
          onChangeText={v => handleProviderSettingChange('stripe_nfc', 'apiKey', v)}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={t('payment.stripeNfc.publishableKey')}
          value={s.publishableKey ?? ''}
          onChangeText={v => handleProviderSettingChange('stripe_nfc', 'publishableKey', v)}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={t('payment.stripeNfc.locationId')}
          value={s.merchantId}
          onChangeText={v => handleProviderSettingChange('stripe_nfc', 'merchantId', v)}
          autoCapitalize="none"
        />
      </View>
    );
  };

  const renderStripeForm = () => {
    if (paymentSettings.provider !== PaymentProvider.STRIPE) return null;
    const s = paymentSettings.stripe;
    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>{t('payment.stripe.title')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('payment.stripe.apiKey')}
          value={s.apiKey ?? ''}
          onChangeText={v => handleProviderSettingChange('stripe', 'apiKey', v)}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={t('payment.stripe.locationId')}
          value={s.locationId ?? ''}
          onChangeText={v => handleProviderSettingChange('stripe', 'locationId', v)}
          autoCapitalize="none"
        />
      </View>
    );
  };

  const renderSquareForm = () => {
    if (paymentSettings.provider !== PaymentProvider.SQUARE) return null;
    const s = paymentSettings.square;
    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>{t('payment.square.title')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('payment.square.applicationId')}
          value={s.applicationId}
          onChangeText={v => handleProviderSettingChange('square', 'applicationId', v)}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={t('payment.square.locationId')}
          value={s.locationId}
          onChangeText={v => handleProviderSettingChange('square', 'locationId', v)}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={t('payment.square.accessToken')}
          value={s.accessToken}
          onChangeText={v => handleProviderSettingChange('square', 'accessToken', v)}
          secureTextEntry
          autoCapitalize="none"
        />
      </View>
    );
  };

  const renderAdyenForm = () => {
    if (paymentSettings.provider !== PaymentProvider.ADYEN) return null;
    const s = paymentSettings.adyen;
    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>{t('payment.adyen.title', { defaultValue: 'Adyen' })}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('payment.adyen.apiKey', { defaultValue: 'API Key' })}
          value={s.apiKey}
          onChangeText={v => handleProviderSettingChange('adyen', 'apiKey', v)}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={t('payment.adyen.clientKey', { defaultValue: 'Client Key' })}
          value={s.clientKey}
          onChangeText={v => handleProviderSettingChange('adyen', 'clientKey', v)}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={t('payment.adyen.merchantAccount', { defaultValue: 'Merchant Account' })}
          value={s.merchantAccount}
          onChangeText={v => handleProviderSettingChange('adyen', 'merchantAccount', v)}
          autoCapitalize="none"
        />
      </View>
    );
  };

  const renderTapPaymentsForm = () => {
    if (paymentSettings.provider !== PaymentProvider.TAP_PAYMENTS) return null;
    const s = paymentSettings.tap_payments;
    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>{t('payment.tapPayments.title', { defaultValue: 'Tap Payments' })}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('payment.tapPayments.apiKey', { defaultValue: 'API Key' })}
          value={s.apiKey}
          onChangeText={v => handleProviderSettingChange('tap_payments', 'apiKey', v)}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={t('payment.tapPayments.publishableKey', { defaultValue: 'Publishable Key' })}
          value={s.publishableKey}
          onChangeText={v => handleProviderSettingChange('tap_payments', 'publishableKey', v)}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={t('payment.tapPayments.merchantId', { defaultValue: 'Merchant ID' })}
          value={s.merchantId}
          onChangeText={v => handleProviderSettingChange('tap_payments', 'merchantId', v)}
          autoCapitalize="none"
        />
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('payment.title')}</Text>
      <Text style={styles.subtitle}>{t('payment.subtitle')}</Text>

      {isLoading && <ActivityIndicator size="large" />}

      {!isLoading && (
        <>
          {renderProviderSelection()}
          {renderStripeNfcForm()}
          {renderStripeForm()}
          {renderSquareForm()}
          {renderAdyenForm()}
          {renderTapPaymentsForm()}
          <Button title={t('payment.testConnection')} onPress={handleTestConnection} />
        </>
      )}

      <View style={styles.buttonContainer}>
        <Button title={t('common.back')} onPress={onBack} />
        <Button title={t('common.next')} onPress={handleNextPress} disabled={isLoading} />
      </View>
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: lightColors.textSecondary, marginBottom: 20, textAlign: 'center' },
  settingGroup: { marginBottom: 20 },
  settingLabel: { fontSize: 18, fontWeight: '500', marginBottom: 10 },
  radioGroup: { flexDirection: 'row', flexWrap: 'wrap' },
  radioButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 5,
    marginRight: 10,
    marginBottom: 10,
  },
  radioButtonSelected: { backgroundColor: lightColors.primary, borderColor: lightColors.primary },
  radioButtonTextSelected: { color: lightColors.textOnPrimary },
  input: { borderWidth: 1, borderColor: lightColors.border, borderRadius: 5, padding: 10, marginBottom: 10 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
});

export default PaymentProviderStep;
