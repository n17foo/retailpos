import React from 'react';
import { View, Text, StyleSheet, Button, Alert, TextInput, ScrollView } from 'react-native';
import { lightColors } from '../../../shared/utils/theme';

interface PlatformConfigurationStepProps {
  platformId: string;
  onBack: () => void;
  onComplete: () => void;
  config: Record<string, string>;
  setConfig: (config: Record<string, string>) => void;
}

// Platform display names
const PLATFORM_NAMES: Record<string, string> = {
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  bigcommerce: 'BigCommerce',
  magento: 'Magento',
  sylius: 'Sylius',
  wix: 'Wix',
  prestashop: 'PrestaShop',
  commercefull: 'Commercefull',
};

const PlatformConfigurationStep: React.FC<PlatformConfigurationStepProps> = ({ platformId, onBack, onComplete, config, setConfig }) => {
  const validateConfig = () => {
    switch (platformId) {
      case 'shopify':
        if (!config.storeUrl || !config.accessToken) {
          Alert.alert('Validation Error', 'Please enter Store URL and Access Token.');
          return false;
        }
        break;
      case 'woocommerce':
        if (!config.storeUrl || !config.apiKey || !config.apiSecret) {
          Alert.alert('Validation Error', 'Please fill in all WooCommerce fields.');
          return false;
        }
        break;
      case 'bigcommerce':
        if (!config.storeHash || !config.accessToken) {
          Alert.alert('Validation Error', 'Please enter Store Hash and Access Token.');
          return false;
        }
        break;
      case 'magento':
        if (!config.storeUrl || !config.accessToken) {
          Alert.alert('Validation Error', 'Please enter Store URL and Access Token.');
          return false;
        }
        break;
      case 'sylius':
        if (!config.storeUrl || !config.apiToken) {
          Alert.alert('Validation Error', 'Please enter API URL and Token.');
          return false;
        }
        break;
      case 'wix':
        if (!config.apiKey || !config.siteId) {
          Alert.alert('Validation Error', 'Please enter API Key and Site ID.');
          return false;
        }
        break;
      case 'prestashop':
        if (!config.storeUrl || !config.apiKey) {
          Alert.alert('Validation Error', 'Please enter Store URL and API Key.');
          return false;
        }
        break;
      case 'commercefull':
        if (!config.storeUrl || !config.apiKey || !config.apiSecret) {
          Alert.alert('Validation Error', 'Please enter Store URL, Email, and Password.');
          return false;
        }
        break;
      case 'offline':
        // Offline mode uses OfflineSetupStep, not this form
        break;
      default:
        break;
    }
    return true;
  };

  const handleComplete = () => {
    if (validateConfig()) {
      onComplete();
    }
  };

  const updateConfig = (field: string, value: string) => {
    setConfig({ ...config, [field]: value });
  };

  const renderShopifyForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>Store URL</Text>
      <TextInput
        style={styles.input}
        value={config.storeUrl || ''}
        onChangeText={value => updateConfig('storeUrl', value)}
        placeholder="https://your-store.myshopify.com"
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>Admin API Access Token</Text>
      <TextInput
        style={styles.input}
        value={config.accessToken || ''}
        onChangeText={value => updateConfig('accessToken', value)}
        placeholder="shpat_..."
        secureTextEntry
        autoCapitalize="none"
      />
    </View>
  );

  const renderWooCommerceForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>Store URL</Text>
      <TextInput
        style={styles.input}
        value={config.storeUrl || ''}
        onChangeText={value => updateConfig('storeUrl', value)}
        placeholder="https://your-wordpress-site.com"
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>Consumer Key</Text>
      <TextInput
        style={styles.input}
        value={config.apiKey || ''}
        onChangeText={value => updateConfig('apiKey', value)}
        placeholder="ck_..."
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>Consumer Secret</Text>
      <TextInput
        style={styles.input}
        value={config.apiSecret || ''}
        onChangeText={value => updateConfig('apiSecret', value)}
        placeholder="cs_..."
        secureTextEntry
        autoCapitalize="none"
      />
    </View>
  );

  const renderBigCommerceForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>Store Hash</Text>
      <TextInput
        style={styles.input}
        value={config.storeHash || ''}
        onChangeText={value => updateConfig('storeHash', value)}
        placeholder="stores/xxxxx"
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>Access Token</Text>
      <TextInput
        style={styles.input}
        value={config.accessToken || ''}
        onChangeText={value => updateConfig('accessToken', value)}
        placeholder="Enter Access Token"
        secureTextEntry
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>Client ID</Text>
      <TextInput
        style={styles.input}
        value={config.clientId || ''}
        onChangeText={value => updateConfig('clientId', value)}
        placeholder="Enter Client ID"
        autoCapitalize="none"
      />
    </View>
  );

  const renderMagentoForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>Store URL</Text>
      <TextInput
        style={styles.input}
        value={config.storeUrl || ''}
        onChangeText={value => updateConfig('storeUrl', value)}
        placeholder="https://your-magento-store.com"
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>Access Token</Text>
      <TextInput
        style={styles.input}
        value={config.accessToken || ''}
        onChangeText={value => updateConfig('accessToken', value)}
        placeholder="Enter Access Token"
        secureTextEntry
        autoCapitalize="none"
      />
    </View>
  );

  const renderSyliusForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>API URL</Text>
      <TextInput
        style={styles.input}
        value={config.storeUrl || ''}
        onChangeText={value => updateConfig('storeUrl', value)}
        placeholder="https://your-sylius-store.com/api"
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>API Token</Text>
      <TextInput
        style={styles.input}
        value={config.apiToken || ''}
        onChangeText={value => updateConfig('apiToken', value)}
        placeholder="Enter API Token"
        secureTextEntry
        autoCapitalize="none"
      />
    </View>
  );

  const renderWixForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>API Key</Text>
      <TextInput
        style={styles.input}
        value={config.apiKey || ''}
        onChangeText={value => updateConfig('apiKey', value)}
        placeholder="Enter Wix API Key"
        secureTextEntry
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>Site ID</Text>
      <TextInput
        style={styles.input}
        value={config.siteId || ''}
        onChangeText={value => updateConfig('siteId', value)}
        placeholder="Enter Wix Site ID"
        autoCapitalize="none"
      />
    </View>
  );

  const renderPrestaShopForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>Store URL</Text>
      <TextInput
        style={styles.input}
        value={config.storeUrl || ''}
        onChangeText={value => updateConfig('storeUrl', value)}
        placeholder="https://your-prestashop-store.com"
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>API Key</Text>
      <TextInput
        style={styles.input}
        value={config.apiKey || ''}
        onChangeText={value => updateConfig('apiKey', value)}
        placeholder="Enter PrestaShop API Key"
        secureTextEntry
        autoCapitalize="none"
      />
    </View>
  );

  const renderCommercefullForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>Store URL</Text>
      <TextInput
        style={styles.input}
        value={config.storeUrl || ''}
        onChangeText={value => updateConfig('storeUrl', value)}
        placeholder="https://your-commercefull-store.com"
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>Email / API Key</Text>
      <TextInput
        style={styles.input}
        value={config.apiKey || ''}
        onChangeText={value => updateConfig('apiKey', value)}
        placeholder="Enter account email or API key"
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>Password / API Secret</Text>
      <TextInput
        style={styles.input}
        value={config.apiSecret || ''}
        onChangeText={value => updateConfig('apiSecret', value)}
        placeholder="Enter account password or API secret"
        secureTextEntry
        autoCapitalize="none"
      />
    </View>
  );

  const renderForm = () => {
    switch (platformId) {
      case 'shopify':
        return renderShopifyForm();
      case 'woocommerce':
        return renderWooCommerceForm();
      case 'bigcommerce':
        return renderBigCommerceForm();
      case 'magento':
        return renderMagentoForm();
      case 'sylius':
        return renderSyliusForm();
      case 'wix':
        return renderWixForm();
      case 'prestashop':
        return renderPrestaShopForm();
      case 'commercefull':
        return renderCommercefullForm();
      case 'offline':
        // Offline mode is handled by OfflineSetupStep
        return <Text style={styles.errorText}>Please use the Offline Setup flow.</Text>;
      default:
        return <Text style={styles.errorText}>Unknown platform: {platformId}</Text>;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Configure {PLATFORM_NAMES[platformId] || platformId}</Text>
      <Text style={styles.subtitle}>Enter your API credentials below.</Text>

      {renderForm()}

      <View style={styles.buttonContainer}>
        <Button title="Back" onPress={onBack} />
        <Button title="Finish Setup" onPress={handleComplete} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    color: lightColors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: lightColors.surface,
  },
  errorText: {
    color: lightColors.error,
    fontSize: 16,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  subtitle: {
    fontSize: 16,
    color: lightColors.textSecondary,
    marginBottom: 30,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 40,
  },
});

export default PlatformConfigurationStep;
