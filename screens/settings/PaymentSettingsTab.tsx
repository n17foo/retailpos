import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { PaymentProvider } from '../../services/payment/PaymentServiceFactory';
import { usePaymentSettings, PaymentSettings } from '../../hooks/usePaymentSettings';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';

type ProviderSettingKey<T extends keyof PaymentSettings> = keyof PaymentSettings[T];

const PaymentSettingsTab = () => {
  const { paymentSettings, handlePaymentSettingsChange, saveSettings, testConnection, error, saveStatus, isLoading, loadSettings } =
    usePaymentSettings();

  const hasUnsavedChanges = saveStatus === 'unsaved';
  const isMounted = useRef(true);

  // Load settings on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await loadSettings();
      } catch (err) {
        console.error('Failed to load payment settings:', err);
      }
    };

    initialize();
    return () => {
      isMounted.current = false;
    };
  }, [loadSettings]);

  // Handle provider change
  const handleProviderChange = useCallback(
    (provider: PaymentProvider) => {
      handlePaymentSettingsChange({
        provider,
        [provider]: paymentSettings[provider as keyof PaymentSettings] || {},
      } as unknown as Partial<PaymentSettings>);
    },
    [handlePaymentSettingsChange, paymentSettings]
  );

  // Handle provider setting changes
  const handleProviderSettingChange = useCallback(
    <T extends keyof PaymentSettings>(provider: T, field: ProviderSettingKey<T>, value: string | boolean) => {
      const updatedSettings = {
        ...paymentSettings,
        [provider]: {
          ...(paymentSettings[provider] as object),
          [field]: value,
        },
      };
      handlePaymentSettingsChange(updatedSettings);
    },
    [handlePaymentSettingsChange, paymentSettings]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    try {
      await saveSettings(paymentSettings);
    } catch (err) {
      console.error('Failed to save payment settings:', err);
    }
  }, [saveSettings, paymentSettings]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    handlePaymentSettingsChange(paymentSettings);
  }, [handlePaymentSettingsChange]);

  // Test connection
  const testPaymentConnection = useCallback(async () => {
    try {
      const success = await testConnection(paymentSettings.provider);
      if (success) {
        Alert.alert('Success', 'Connection test successful!');
      } else {
        Alert.alert('Error', 'Failed to connect to payment provider');
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      Alert.alert('Error', 'Connection test failed. Please check your settings.');
    }
  }, [testConnection, paymentSettings.provider]);

  // Render provider selection radio buttons
  const renderProviderSelection = () => (
    <View style={styles.settingGroup}>
      <Text style={styles.settingLabel}>Payment Provider</Text>
      <View style={styles.radioGroup}>
        {Object.values(PaymentProvider).map(provider => (
          <TouchableOpacity
            key={provider}
            style={[styles.radioButton, paymentSettings.provider === provider && styles.radioButtonSelected]}
            onPress={() => handleProviderChange(provider)}
            disabled={isLoading}
          >
            <View style={[styles.radioButtonOuter, paymentSettings.provider === provider && styles.radioButtonOuterSelected]}>
              {paymentSettings.provider === provider && <View style={styles.radioButtonInner} />}
            </View>
            <Text style={styles.radioButtonLabel}>{provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Render Worldpay form
  const renderWorldpayForm = () => {
    if (paymentSettings.provider !== PaymentProvider.WORLDPAY) return null;

    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Worldpay Settings</Text>
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={paymentSettings.worldpay?.merchantId || ''}
            onChangeText={value => handleProviderSettingChange('worldpay', 'merchantId', value)}
            placeholder="Merchant ID"
            editable={!isLoading}
          />
        </View>
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={paymentSettings.worldpay?.siteReference || ''}
            onChangeText={value => handleProviderSettingChange('worldpay', 'siteReference', value)}
            placeholder="Site Reference"
            editable={!isLoading}
          />
        </View>
      </View>
    );
  };

  // Render Stripe PED form
  const renderStripeForm = () => {
    if (paymentSettings.provider !== PaymentProvider.STRIPE) return null;

    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Stripe Terminal (PED) Settings</Text>
        <View style={styles.inputGroup}>
          <Text>API Key</Text>
          <TextInput
            style={styles.input}
            placeholder="Stripe API Key"
            value={paymentSettings.stripe?.apiKey || ''}
            onChangeText={value => handleProviderSettingChange('stripe', 'apiKey', value)}
            editable={!isLoading}
            secureTextEntry
          />
        </View>
        <View style={styles.inputGroup}>
          <Text>Location ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Stripe Location ID"
            value={paymentSettings.stripe?.locationId || ''}
            onChangeText={value => handleProviderSettingChange('stripe', 'locationId', value)}
            editable={!isLoading}
          />
        </View>
      </View>
    );
  };

  // Render Stripe NFC Tap to Pay form
  const renderStripeNfcForm = () => {
    if (paymentSettings.provider !== PaymentProvider.STRIPE_NFC) return null;

    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Stripe NFC Tap to Pay Settings</Text>

        {/* API Credentials Section */}
        <View style={[styles.settingGroup, { marginBottom: 20 }]}>
          <Text style={styles.settingLabel}>API Credentials</Text>
          <View style={styles.inputGroup}>
            <Text>API Key</Text>
            <TextInput
              style={styles.input}
              placeholder="Stripe API Key (sk_test_...)"
              value={paymentSettings.stripe_nfc?.apiKey || ''}
              onChangeText={value => handleProviderSettingChange('stripe_nfc', 'apiKey', value)}
              editable={!isLoading}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text>Publishable Key</Text>
            <TextInput
              style={styles.input}
              placeholder="Stripe Publishable Key (pk_test_...)"
              value={paymentSettings.stripe_nfc?.publishableKey || ''}
              onChangeText={value => handleProviderSettingChange('stripe_nfc', 'publishableKey', value)}
              editable={!isLoading}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text>Location ID</Text>
            <TextInput
              style={styles.input}
              placeholder="Stripe Location ID"
              value={paymentSettings.stripe_nfc?.merchantId || ''}
              onChangeText={value => handleProviderSettingChange('stripe_nfc', 'merchantId', value)}
              editable={!isLoading}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Backend Configuration Section */}
        <View style={[styles.settingGroup, { marginBottom: 20 }]}>
          <Text style={styles.settingLabel}>Backend Configuration</Text>
          <View style={styles.inputGroup}>
            <Text>Backend URL</Text>
            <TextInput
              style={styles.input}
              placeholder="Stripe Backend URL (https://...)"
              value={paymentSettings.stripe_nfc?.backendUrl || ''}
              onChangeText={value => handleProviderSettingChange('stripe_nfc', 'backendUrl', value)}
              editable={!isLoading}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.label}>Use Direct API (no backend)</Text>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                paymentSettings.stripe_nfc?.useDirectApi ? styles.toggleActive : styles.toggleInactive,
                isLoading && styles.disabled,
              ]}
              onPress={() => handleProviderSettingChange('stripe_nfc', 'useDirectApi', !paymentSettings.stripe_nfc?.useDirectApi)}
              disabled={isLoading}
            >
              <Text style={styles.toggleText}>{paymentSettings.stripe_nfc?.useDirectApi ? 'On' : 'Off'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reader Configuration Section */}
        <View style={[styles.settingGroup, { marginBottom: 20 }]}>
          <Text style={styles.settingLabel}>Reader Configuration</Text>
          <View style={styles.optionRow}>
            <Text style={styles.label}>Enable NFC Reader</Text>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                paymentSettings.stripe_nfc?.enableNfc ? styles.toggleActive : styles.toggleInactive,
                isLoading && styles.disabled,
              ]}
              onPress={() => handleProviderSettingChange('stripe_nfc', 'enableNfc', !paymentSettings.stripe_nfc?.enableNfc)}
              disabled={isLoading}
            >
              <Text style={styles.toggleText}>{paymentSettings.stripe_nfc?.enableNfc ? 'On' : 'Off'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.label}>Use Simulated Reader</Text>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                paymentSettings.stripe_nfc?.useSimulatedReader ? styles.toggleActive : styles.toggleInactive,
                isLoading && styles.disabled,
              ]}
              onPress={() =>
                handleProviderSettingChange('stripe_nfc', 'useSimulatedReader', !paymentSettings.stripe_nfc?.useSimulatedReader)
              }
              disabled={isLoading}
            >
              <Text style={styles.toggleText}>{paymentSettings.stripe_nfc?.useSimulatedReader ? 'On' : 'Off'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text>Connection Timeout (seconds)</Text>
            <TextInput
              style={styles.input}
              placeholder="30"
              value={paymentSettings.stripe_nfc?.connectionTimeout || '30'}
              onChangeText={value => handleProviderSettingChange('stripe_nfc', 'connectionTimeout', value)}
              editable={!isLoading}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Test Connection Button */}
        <TouchableOpacity
          style={[styles.verticalButton, styles.testButton, isLoading && styles.buttonDisabled, { marginTop: 20 }]}
          onPress={async () => {
            try {
              // Save settings first
              await saveSettings(paymentSettings);
              // Then test connection
              await testPaymentConnection();
            } catch (err) {
              Alert.alert('Error', 'Failed to test connection. Please check your settings.');
            }
          }}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Terminal Connection</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render Square form
  const renderSquareForm = () => {
    if (paymentSettings.provider !== PaymentProvider.SQUARE) return null;

    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Square Settings</Text>
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={paymentSettings.square?.applicationId || ''}
            onChangeText={value => handleProviderSettingChange('square', 'applicationId', value)}
            placeholder="Application ID"
            editable={!isLoading}
          />
        </View>
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={paymentSettings.square?.locationId || ''}
            onChangeText={value => handleProviderSettingChange('square', 'locationId', value)}
            placeholder="Location ID"
            editable={!isLoading}
          />
        </View>
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={paymentSettings.square?.accessToken || ''}
            onChangeText={value => handleProviderSettingChange('square', 'accessToken', value)}
            placeholder="Access Token"
            secureTextEntry
            editable={!isLoading}
          />
        </View>
      </View>
    );
  };

  // Render loading state
  if (isLoading && !paymentSettings.provider) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a84ff" />
        <Text style={styles.loadingText}>Loading payment settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Payment Settings</Text>

      {/* Provider Selection */}
      {renderProviderSelection()}

      {/* Provider-specific forms */}
      {renderWorldpayForm()}
      {renderStripeForm()}
      {renderStripeNfcForm()}
      {renderSquareForm()}

      {/* Sync Inventory Toggle */}
      <View style={styles.optionRow}>
        <Text style={styles.label}>Sync Inventory</Text>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            paymentSettings.syncInventory ? styles.toggleActive : styles.toggleInactive,
            isLoading && styles.disabled,
          ]}
          onPress={() =>
            !isLoading &&
            handlePaymentSettingsChange({
              ...paymentSettings,
              syncInventory: !paymentSettings.syncInventory,
            })
          }
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
          {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>Test Connection</Text>}
        </TouchableOpacity>

        <View style={styles.horizontalButtonGroup}>
          <TouchableOpacity
            style={[styles.halfButton, styles.cancelButton, (!hasUnsavedChanges || isLoading) && styles.buttonDisabled]}
            onPress={handleCancel}
            disabled={!hasUnsavedChanges || isLoading}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.halfButton, styles.saveButton, (!hasUnsavedChanges || isLoading) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!hasUnsavedChanges || isLoading}
          >
            {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Status messages */}
      {(error || saveStatus === 'saved') && (
        <View style={styles.statusContainer}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : saveStatus === 'saved' ? (
            <Text style={styles.successText}>Settings saved successfully!</Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: lightColors.background,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semiBold as '600',
    marginBottom: spacing.lg,
    color: lightColors.textPrimary,
  },
  settingGroup: {
    marginBottom: spacing.lg,
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...elevation.low,
  },
  settingLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium as '500',
    color: lightColors.textPrimary,
    marginBottom: spacing.md,
  },
  radioGroup: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginBottom: spacing.xs,
  },
  radioButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginRight: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  radioButtonSelected: {
    backgroundColor: `${lightColors.primary}20`,
  },
  radioButtonOuter: {
    width: 22,
    height: 22,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: lightColors.textSecondary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: spacing.sm,
  },
  radioButtonOuterSelected: {
    borderColor: lightColors.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: lightColors.primary,
  },
  radioButtonLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
    backgroundColor: lightColors.surface,
    color: lightColors.textPrimary,
  },
  // Toggle button styles
  toggleButton: {
    width: 60,
    height: 30,
    borderRadius: borderRadius.round,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    paddingHorizontal: spacing.xs,
  },
  toggleActive: {
    backgroundColor: lightColors.primary,
  },
  toggleInactive: {
    backgroundColor: lightColors.divider,
  },
  toggleText: {
    color: lightColors.textOnPrimary,
    fontWeight: typography.fontWeight.bold as '700',
    fontSize: typography.fontSize.xs,
  },
  disabled: {
    opacity: 0.5,
  },
  optionRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  verticalButtonGroup: {
    width: '100%',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  horizontalButtonGroup: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    width: '100%',
    gap: spacing.sm,
  },
  verticalButton: {
    width: '100%',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: 48,
    ...elevation.low,
  },
  halfButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: 48,
    ...elevation.low,
  },
  statusContainer: {
    width: '100%',
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    backgroundColor: `${lightColors.info}10`,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: lightColors.primary,
  },
  saveButton: {
    backgroundColor: lightColors.primary,
  },
  testButton: {
    backgroundColor: lightColors.success,
  },
  cancelButton: {
    backgroundColor: lightColors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold as '600',
  },
  errorText: {
    color: lightColors.error,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium as '500',
    textAlign: 'left' as const,
  },
  successText: {
    color: lightColors.success,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium as '500',
    textAlign: 'left' as const,
  },
  loadingText: {
    marginTop: spacing.md,
    color: lightColors.textSecondary,
    fontSize: typography.fontSize.md,
    textAlign: 'center' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing.lg,
  },
});

export default PaymentSettingsTab;
