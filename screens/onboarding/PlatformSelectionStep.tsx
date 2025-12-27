import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// E-commerce platforms - synced with EcommerceSettingsTab
const PLATFORMS = [
  { id: 'shopify', name: 'Shopify' },
  { id: 'woocommerce', name: 'WooCommerce' },
  { id: 'bigcommerce', name: 'BigCommerce' },
  { id: 'magento', name: 'Magento' },
  { id: 'sylius', name: 'Sylius' },
  { id: 'wix', name: 'Wix' },
  { id: 'prestashop', name: 'PrestaShop' },
  { id: 'squarespace', name: 'Squarespace' },
  { id: 'custom', name: 'Custom API' },
];

interface PlatformSelectionStepProps {
  onSelectPlatform: (platformId: string) => void;
}

const PlatformSelectionStep: React.FC<PlatformSelectionStepProps> = ({ onSelectPlatform }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your E-Commerce Platform</Text>
      <Text style={styles.subtitle}>Choose the platform your online store is built on.</Text>
      <View style={styles.platformList}>
        {PLATFORMS.map(platform => (
          <TouchableOpacity key={platform.id} style={styles.platformButton} onPress={() => onSelectPlatform(platform.id)}>
            <Text style={styles.platformButtonText}>{platform.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 30,
    textAlign: 'center',
  },
  platformList: {
    width: '100%',
  },
  platformButton: {
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  platformButtonText: {
    fontSize: 18,
    fontWeight: '500',
  },
});

export default PlatformSelectionStep;
