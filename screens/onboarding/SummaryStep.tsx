import React from 'react';
import { View, Text, StyleSheet, Button, ScrollView } from 'react-native';
import { useEcommerceSettings } from '../../hooks/useEcommerceSettings';
import { usePaymentSettings } from '../../hooks/usePaymentSettings';
import { usePrinterSettings } from '../../hooks/usePrinterSettings';
import { useScannerSettings } from '../../hooks/useScannerSettings';
import { useTranslate } from '../../hooks/useTranslate';

interface SummaryStepProps {
  onBack: () => void;
  onConfirm: () => void;
}

const SummaryStep: React.FC<SummaryStepProps> = ({ onBack, onConfirm }) => {
  const { t } = useTranslate();
  const { ecommerceSettings } = useEcommerceSettings();
  const { paymentSettings } = usePaymentSettings();
  const { printerSettings } = usePrinterSettings();
  const { scannerSettings } = useScannerSettings();

  const renderSetting = (label: string, value: string | undefined | null) => (
    <View style={styles.settingRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || t('common.notSet')}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('summary.title')}</Text>
      <Text style={styles.subtitle}>{t('summary.subtitle')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('summary.ecommerce')}</Text>
        {renderSetting(t('summary.platform'), ecommerceSettings.platform)}
        {ecommerceSettings.platform === 'shopify' && renderSetting(t('summary.storeUrl'), ecommerceSettings.shopify?.storeUrl)}
        {ecommerceSettings.platform === 'woocommerce' && renderSetting(t('summary.storeUrl'), ecommerceSettings.woocommerce?.storeUrl)}
        {ecommerceSettings.platform === 'bigcommerce' && renderSetting(t('summary.storeHash'), ecommerceSettings.bigcommerce?.storeHash)}
        {ecommerceSettings.platform === 'magento' && renderSetting(t('summary.storeUrl'), ecommerceSettings.magento?.storeUrl)}
        {ecommerceSettings.platform === 'sylius' && renderSetting(t('summary.apiUrl'), ecommerceSettings.sylius?.storeUrl)}
        {ecommerceSettings.platform === 'wix' && renderSetting(t('summary.siteId'), ecommerceSettings.wix?.siteId)}
        {ecommerceSettings.platform === 'prestashop' && renderSetting(t('summary.storeUrl'), ecommerceSettings.prestashop?.storeUrl)}
        {ecommerceSettings.platform === 'squarespace' && renderSetting(t('summary.siteId'), ecommerceSettings.squarespace?.siteId)}
        {ecommerceSettings.platform === 'offline' && renderSetting(t('summary.storeName'), ecommerceSettings.offline?.storeName)}
        {ecommerceSettings.platform === 'offline' && renderSetting(t('summary.currency'), ecommerceSettings.offline?.currency)}
        {ecommerceSettings.platform === 'offline' &&
          renderSetting(t('summary.categories'), String(ecommerceSettings.offline?.categories?.length || 0))}
        {ecommerceSettings.platform === 'offline' &&
          renderSetting(
            t('summary.products'),
            String(ecommerceSettings.offline?.categories?.reduce((sum, c) => sum + (c.products?.length || 0), 0) || 0)
          )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('summary.paymentProvider')}</Text>
        {renderSetting(t('summary.providerLabel'), paymentSettings.provider)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('summary.printer')}</Text>
        {renderSetting(t('common.enabled'), printerSettings.enabled ? t('common.yes') : t('common.no'))}
        {printerSettings.enabled && renderSetting(t('summary.name'), printerSettings.printerName)}
        {printerSettings.enabled && renderSetting(t('summary.connection'), printerSettings.connectionType)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('summary.scanner')}</Text>
        {renderSetting(t('common.enabled'), scannerSettings.enabled ? t('common.yes') : t('common.no'))}
        {scannerSettings.enabled && renderSetting(t('summary.type'), scannerSettings.type)}
      </View>

      <View style={styles.buttonContainer}>
        <Button title={t('common.back')} onPress={onBack} />
        <Button title={t('summary.confirmFinish')} onPress={onConfirm} />
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
