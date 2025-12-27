import React from 'react';
import { View, Text, StyleSheet, Button, ScrollView } from 'react-native';
import { useEcommerceSettings } from '../../hooks/useEcommerceSettings';
import { usePaymentSettings } from '../../hooks/usePaymentSettings';
import { usePrinterSettings } from '../../hooks/usePrinterSettings';
import { useScannerSettings } from '../../hooks/useScannerSettings';

interface SummaryStepProps {
  onBack: () => void;
  onConfirm: () => void;
}

const SummaryStep: React.FC<SummaryStepProps> = ({ onBack, onConfirm }) => {
  const { ecommerceSettings } = useEcommerceSettings();
  const { paymentSettings } = usePaymentSettings();
  const { printerSettings } = usePrinterSettings();
  const { scannerSettings } = useScannerSettings();

  const renderSetting = (label: string, value: string | undefined | null) => (
    <View style={styles.settingRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || 'Not set'}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Onboarding Summary</Text>
      <Text style={styles.subtitle}>Please review your settings before completing the setup.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>E-Commerce</Text>
        {renderSetting('Platform', ecommerceSettings.platform)}
        {ecommerceSettings.platform === 'shopify' && renderSetting('Store URL', ecommerceSettings.shopify?.storeUrl)}
        {ecommerceSettings.platform === 'woocommerce' && renderSetting('Store URL', ecommerceSettings.woocommerce?.storeUrl)}
        {ecommerceSettings.platform === 'bigcommerce' && renderSetting('Store Hash', ecommerceSettings.bigcommerce?.storeHash)}
        {ecommerceSettings.platform === 'magento' && renderSetting('Store URL', ecommerceSettings.magento?.storeUrl)}
        {ecommerceSettings.platform === 'sylius' && renderSetting('API URL', ecommerceSettings.sylius?.storeUrl)}
        {ecommerceSettings.platform === 'wix' && renderSetting('Site ID', ecommerceSettings.wix?.siteId)}
        {ecommerceSettings.platform === 'prestashop' && renderSetting('Store URL', ecommerceSettings.prestashop?.storeUrl)}
        {ecommerceSettings.platform === 'squarespace' && renderSetting('Site ID', ecommerceSettings.squarespace?.siteId)}
        {ecommerceSettings.platform === 'custom' && renderSetting('API URL', ecommerceSettings.apiUrl)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Provider</Text>
        {renderSetting('Provider', paymentSettings.provider)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Printer</Text>
        {renderSetting('Enabled', printerSettings.enabled ? 'Yes' : 'No')}
        {printerSettings.enabled && renderSetting('Name', printerSettings.printerName)}
        {printerSettings.enabled && renderSetting('Connection', printerSettings.connectionType)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scanner</Text>
        {renderSetting('Enabled', scannerSettings.enabled ? 'Yes' : 'No')}
        {scannerSettings.enabled && renderSetting('Type', scannerSettings.type)}
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Back" onPress={onBack} />
        <Button title="Confirm & Finish" onPress={onConfirm} />
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
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 16,
    color: '#333',
  },
  value: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
});

export default SummaryStep;
