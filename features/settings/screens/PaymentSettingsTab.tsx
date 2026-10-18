import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import { usePaymentSettings, PaymentSettings } from '../../payments/hooks/usePaymentSettings';
import { lightColors } from '../../../shared/utils/theme';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { useLogger } from '../../../shared/hooks/useLogger';
import { auditLogService } from '../../../shared/services/audit/AuditLogService';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import { paymentSettingsStyles as styles } from '../components/paymentSettingsStyles';
import { PaymentProviderSelector } from '../components/PaymentProviderSelector';
import { StripeNfcSettingsForm } from '../components/StripeNfcSettingsForm';
import { StripeSettingsForm } from '../components/StripeSettingsForm';
import { SquareSettingsForm } from '../components/SquareSettingsForm';
import { AdyenSettingsForm } from '../components/AdyenSettingsForm';
import { TapPaymentsSettingsForm } from '../components/TapPaymentsSettingsForm';

type ProviderSettingKey<T extends keyof PaymentSettings> = keyof PaymentSettings[T];

const PaymentSettingsTab = () => {
  const { t } = useTranslate();
  const { user } = useAuthContext();
  const { paymentSettings, handlePaymentSettingsChange, saveSettings, testConnection, error, saveStatus, isLoading, loadSettings } =
    usePaymentSettings();
  const logger = useLogger('PaymentSettingsTab');
  const isMounted = useRef(true);

  const hasUnsavedChanges = saveStatus === 'unsaved';

  useEffect(() => {
    loadSettings().catch(err => logger.error('Failed to load payment settings:', err));
    return () => {
      isMounted.current = false;
    };
  }, [loadSettings, logger]);

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

  const handleSave = useCallback(async () => {
    // Validate required fields per provider
    const { provider, stripe_nfc, stripe, square, adyen, tap_payments } = paymentSettings;

    if (provider === PaymentProvider.STRIPE_NFC && !stripe_nfc.apiKey) {
      Alert.alert(t('common.error'), t('settings.payment.stripeNfcKeyRequired', { defaultValue: 'API Key is required for Stripe NFC' }));
      return;
    }
    if (provider === PaymentProvider.STRIPE && (!stripe.publishableKey || !stripe.secretKey)) {
      Alert.alert(
        t('common.error'),
        t('settings.payment.stripeKeysRequired', { defaultValue: 'Publishable Key and Secret Key are required for Stripe' })
      );
      return;
    }
    if (provider === PaymentProvider.SQUARE && (!square.accessToken || !square.applicationId)) {
      Alert.alert(
        t('common.error'),
        t('settings.payment.squareKeysRequired', { defaultValue: 'Access Token and Application ID are required for Square' })
      );
      return;
    }
    if (provider === PaymentProvider.ADYEN && (!adyen.apiKey || !adyen.merchantAccount)) {
      Alert.alert(
        t('common.error'),
        t('settings.payment.adyenKeysRequired', { defaultValue: 'API Key and Merchant Account are required for Adyen' })
      );
      return;
    }
    if (provider === PaymentProvider.TAP_PAYMENTS && (!tap_payments.apiKey || !tap_payments.merchantId)) {
      Alert.alert(
        t('common.error'),
        t('settings.payment.tapPaymentsKeysRequired', { defaultValue: 'API Key and Merchant ID are required for Tap Payments' })
      );
      return;
    }

    try {
      await saveSettings(paymentSettings);
      await auditLogService.log('settings:changed', {
        userId: user?.id,
        userName: user?.username,
        details: 'Payment settings updated',
        metadata: { settingName: 'payment', provider: paymentSettings.provider },
      });
    } catch (err) {
      logger.error('Failed to save payment settings:', err instanceof Error ? err : new Error(String(err)));
    }
  }, [saveSettings, paymentSettings, user, logger, t]);

  const handleCancel = useCallback(() => {
    loadSettings().catch(err => logger.error('Failed to reload payment settings on cancel:', err));
  }, [loadSettings, logger]);

  const testPaymentConnection = useCallback(async () => {
    try {
      const success = await testConnection(paymentSettings.provider);
      Alert.alert(
        success ? t('common.success') : t('common.error'),
        success ? t('settings.payment.connectionSuccess') : t('settings.payment.connectionError')
      );
    } catch (err) {
      logger.error('Connection test failed:', err instanceof Error ? err : new Error(String(err)));
      Alert.alert(t('common.error'), t('settings.payment.connectionTestFailed'));
    }
  }, [testConnection, paymentSettings.provider, t, logger]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading && !paymentSettings.provider) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={lightColors.primary} />
        <Text style={styles.loadingText}>{t('settings.payment.loadingPayment')}</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>{t('settings.payment.title')}</Text>

      <PaymentProviderSelector selected={paymentSettings.provider} isLoading={isLoading} onSelect={handleProviderChange} />

      <StripeNfcSettingsForm
        paymentSettings={paymentSettings}
        isLoading={isLoading}
        onSettingChange={(field, value) => handleProviderSettingChange('stripe_nfc', field as keyof PaymentSettings['stripe_nfc'], value)}
        onSaveAndTest={async () => {
          await saveSettings(paymentSettings);
          await testPaymentConnection();
        }}
      />
      <StripeSettingsForm
        paymentSettings={paymentSettings}
        isLoading={isLoading}
        onSettingChange={(field, value) => handleProviderSettingChange('stripe', field as keyof PaymentSettings['stripe'], value)}
      />
      <SquareSettingsForm
        paymentSettings={paymentSettings}
        isLoading={isLoading}
        onSettingChange={(field, value) => handleProviderSettingChange('square', field as keyof PaymentSettings['square'], value)}
      />
      <AdyenSettingsForm
        paymentSettings={paymentSettings}
        isLoading={isLoading}
        onSettingChange={(field, value) => handleProviderSettingChange('adyen', field as keyof PaymentSettings['adyen'], value)}
      />
      <TapPaymentsSettingsForm
        paymentSettings={paymentSettings}
        isLoading={isLoading}
        onSettingChange={(field, value) =>
          handleProviderSettingChange('tap_payments', field as keyof PaymentSettings['tap_payments'], value)
        }
      />

      <View style={styles.optionRow}>
        <Text style={styles.label}>{t('settings.payment.syncInventory')}</Text>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            paymentSettings.syncInventory ? styles.toggleActive : styles.toggleInactive,
            isLoading && styles.disabled,
          ]}
          onPress={() => !isLoading && handlePaymentSettingsChange({ syncInventory: !paymentSettings.syncInventory })}
          disabled={isLoading}
        >
          <Text style={styles.toggleText}>{paymentSettings.syncInventory ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.verticalButtonGroup}>
        <TouchableOpacity
          style={[styles.verticalButton, styles.testButton, isLoading && styles.buttonDisabled]}
          onPress={testPaymentConnection}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t('settings.payment.testConnection')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.horizontalButtonGroup}>
          <TouchableOpacity
            style={[styles.halfButton, styles.cancelButton, (!hasUnsavedChanges || isLoading) && styles.buttonDisabled]}
            onPress={handleCancel}
            disabled={!hasUnsavedChanges || isLoading}
          >
            <Text style={styles.buttonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.halfButton, styles.saveButton, (!hasUnsavedChanges || isLoading) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!hasUnsavedChanges || isLoading}
          >
            {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>{t('common.save')}</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {(error || saveStatus === 'saved') && (
        <View style={styles.statusContainer}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : saveStatus === 'saved' ? (
            <Text style={styles.successText}>{t('settings.payment.settingsSaved')}</Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
};

export default PaymentSettingsTab;
