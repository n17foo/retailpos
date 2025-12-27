import React, { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Button, ActivityIndicator, Alert } from 'react-native';
import { usePaymentSettings, PaymentSettings } from '../../hooks/usePaymentSettings';
import { PaymentProvider } from '../../services/payment/paymentServiceFactory';

interface PaymentProviderStepProps {
  onBack: () => void;
  onNext: () => void;
}

type ProviderSettingKey<T extends keyof PaymentSettings> = keyof PaymentSettings[T];

const PaymentProviderStep: React.FC<PaymentProviderStepProps> = ({ onBack, onNext }) => {
  const { paymentSettings, handlePaymentSettingsChange, saveSettings, isLoading, loadSettings, testConnection } = usePaymentSettings();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleProviderChange = useCallback(
    (provider: PaymentProvider) => {
      handlePaymentSettingsChange({
        provider,
        [provider]: paymentSettings[provider as keyof PaymentSettings] || {},
      } as unknown as Partial<PaymentSettings>);
    },
    [handlePaymentSettingsChange, paymentSettings]
  );

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

  const validateSettings = () => {
    const { provider, worldpay, stripe, stripe_nfc, square } = paymentSettings;
    switch (provider) {
      case PaymentProvider.WORLDPAY:
        if (!worldpay?.merchantId) {
          Alert.alert('Validation Error', 'Please enter a Worldpay Merchant ID.');
          return false;
        }
        break;
      case PaymentProvider.STRIPE:
        if (!stripe?.apiKey || !stripe?.locationId) {
          Alert.alert('Validation Error', 'Please enter both Stripe API Key and Location ID.');
          return false;
        }
        break;
      case PaymentProvider.STRIPE_NFC:
        if (!stripe_nfc?.apiKey || !stripe_nfc?.publishableKey) {
          Alert.alert('Validation Error', 'Please enter both Stripe API Key and Publishable Key for Tap to Pay.');
          return false;
        }
        break;
      case PaymentProvider.SQUARE:
        if (!square?.applicationId) {
          Alert.alert('Validation Error', 'Please enter a Square Application ID.');
          return false;
        }
        break;
      default:
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
    Alert.alert(success ? 'Success' : 'Failure', `Connection test ${success ? 'succeeded' : 'failed'}.`);
  };

  const renderProviderSelection = () => (
    <View style={styles.settingGroup}>
      <Text style={styles.settingLabel}>Payment Provider</Text>
      <View style={styles.radioGroup}>
        {Object.values(PaymentProvider).map(provider => (
          <TouchableOpacity
            key={provider}
            style={[styles.radioButton, paymentSettings.provider === provider && styles.radioButtonSelected]}
            onPress={() => handleProviderChange(provider)}
          >
            <Text>{provider}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderWorldpayForm = () => {
    if (paymentSettings.provider !== PaymentProvider.WORLDPAY) return null;
    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Worldpay Settings</Text>
        <TextInput
          style={styles.input}
          value={paymentSettings.worldpay?.merchantId || ''}
          onChangeText={value => handleProviderSettingChange('worldpay', 'merchantId', value)}
          placeholder="Merchant ID"
        />
      </View>
    );
  };

  const renderStripeForm = () => {
    if (paymentSettings.provider !== PaymentProvider.STRIPE) return null;
    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Stripe Terminal (PED) Settings</Text>
        <TextInput
          style={styles.input}
          placeholder="API Key"
          value={paymentSettings.stripe?.apiKey || ''}
          onChangeText={value => handleProviderSettingChange('stripe', 'apiKey', value)}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Location ID"
          value={paymentSettings.stripe?.locationId || ''}
          onChangeText={value => handleProviderSettingChange('stripe', 'locationId', value)}
        />
      </View>
    );
  };

  const renderStripeNfcForm = () => {
    if (paymentSettings.provider !== PaymentProvider.STRIPE_NFC) return null;
    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Stripe NFC Tap to Pay Settings</Text>
        <TextInput
          style={styles.input}
          placeholder="API Key (sk_test_...)"
          value={paymentSettings.stripe_nfc?.apiKey || ''}
          onChangeText={value => handleProviderSettingChange('stripe_nfc', 'apiKey', value)}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Publishable Key (pk_test_...)"
          value={paymentSettings.stripe_nfc?.publishableKey || ''}
          onChangeText={value => handleProviderSettingChange('stripe_nfc', 'publishableKey', value)}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Location ID"
          value={paymentSettings.stripe_nfc?.merchantId || ''}
          onChangeText={value => handleProviderSettingChange('stripe_nfc', 'merchantId', value)}
          autoCapitalize="none"
        />
      </View>
    );
  };

  const renderSquareForm = () => {
    if (paymentSettings.provider !== PaymentProvider.SQUARE) return null;
    return (
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Square Settings</Text>
        <TextInput
          style={styles.input}
          placeholder="Application ID"
          value={paymentSettings.square?.applicationId || ''}
          onChangeText={value => handleProviderSettingChange('square', 'applicationId', value)}
        />
        <TextInput
          style={styles.input}
          placeholder="Location ID"
          value={paymentSettings.square?.locationId || ''}
          onChangeText={value => handleProviderSettingChange('square', 'locationId', value)}
        />
        <TextInput
          style={styles.input}
          placeholder="Access Token"
          value={paymentSettings.square?.accessToken || ''}
          onChangeText={value => handleProviderSettingChange('square', 'accessToken', value)}
          secureTextEntry
        />
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Configure Payment Provider</Text>
      <Text style={styles.subtitle}>Select and set up your payment terminal.</Text>

      {isLoading && <ActivityIndicator size="large" />}

      {!isLoading && (
        <>
          {renderProviderSelection()}
          {renderWorldpayForm()}
          {renderStripeForm()}
          {renderStripeNfcForm()}
          {renderSquareForm()}
          <Button title="Test Connection" onPress={handleTestConnection} />
        </>
      )}

      <View style={styles.buttonContainer}>
        <Button title="Back" onPress={onBack} />
        <Button title="Next" onPress={handleNextPress} disabled={isLoading} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  settingGroup: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  radioButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginRight: 10,
    marginBottom: 10,
  },
  radioButtonSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
});

export default PaymentProviderStep;
