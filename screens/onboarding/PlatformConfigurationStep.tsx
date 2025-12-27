import React from 'react';
import { View, Text, StyleSheet, Button, Alert, TextInput, ScrollView } from 'react-native';

interface PlatformConfigurationStepProps {
  platformId: string;
  onBack: () => void;
  onComplete: () => void;
  config: any;
  setConfig: (config: any) => void;
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
  squarespace: 'Squarespace',
  custom: 'Custom API',
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
      case 'squarespace':
        if (!config.apiKey) {
          Alert.alert('Validation Error', 'Please enter API Key.');
          return false;
        }
        break;
      case 'custom':
        if (!config.menuUrl) {
          Alert.alert('Validation Error', 'Please enter the Menu Download URL.');
          return false;
        }
        // Validate URL format
        try {
          new URL(config.menuUrl);
        } catch {
          Alert.alert('Validation Error', 'Please enter a valid URL for menu download.');
          return false;
        }
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

  const renderSquarespaceForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.inputLabel}>API Key</Text>
      <TextInput
        style={styles.input}
        value={config.apiKey || ''}
        onChangeText={value => updateConfig('apiKey', value)}
        placeholder="Enter Squarespace API Key"
        secureTextEntry
        autoCapitalize="none"
      />
      <Text style={styles.inputLabel}>Site ID (Optional)</Text>
      <TextInput
        style={styles.input}
        value={config.siteId || ''}
        onChangeText={value => updateConfig('siteId', value)}
        placeholder="Enter Squarespace Site ID"
        autoCapitalize="none"
      />
    </View>
  );

  const renderCustomForm = () => (
    <View style={styles.formContainer}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Local-Only Mode</Text>
        <Text style={styles.infoText}>
          This mode works offline without connecting to an online store. Simply provide a public URL where your menu/products JSON can be
          downloaded.
        </Text>
        <Text style={styles.infoText}>
          Features: Download menu, create orders, print receipts.
          {'\n'}Not available: Online sync, refunds to platform, inventory sync.
        </Text>
      </View>

      <Text style={styles.inputLabel}>Menu Download URL *</Text>
      <TextInput
        style={styles.input}
        value={config.menuUrl || ''}
        onChangeText={value => updateConfig('menuUrl', value)}
        placeholder="https://example.com/menu.json"
        autoCapitalize="none"
        keyboardType="url"
      />
      <Text style={styles.helpText}>JSON format: {`{ "products": [...], "categories": [...] }`}</Text>

      <Text style={styles.inputLabel}>Store Name (Optional)</Text>
      <TextInput
        style={styles.input}
        value={config.storeName || ''}
        onChangeText={value => updateConfig('storeName', value)}
        placeholder="My Local Store"
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
      case 'squarespace':
        return renderSquarespaceForm();
      case 'custom':
        return renderCustomForm();
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
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 16,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#e7f3ff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0056b3',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 5,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: -10,
    marginBottom: 15,
    fontStyle: 'italic',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
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
