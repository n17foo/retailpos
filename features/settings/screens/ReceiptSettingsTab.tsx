import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useReceiptConfig } from '../../hardware/hooks/useReceiptConfig';
import { lightColors } from '../../../shared/utils/theme';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { receiptSettingsStyles as styles, PRINTER_MODELS, PrinterModelType } from '../components/receiptSettingsStyles';
import { PrinterModelSection } from '../components/PrinterModelSection';
import { ReceiptHeaderForm } from '../components/ReceiptHeaderForm';
import { ReceiptFooterForm } from '../components/ReceiptFooterForm';
import { ReceiptPrintOptionsSection } from '../components/ReceiptPrintOptionsSection';

const ReceiptSettingsTab: React.FC = () => {
  const { t } = useTranslate();
  const { config, isLoading, error, updateHeader, updateFooter, updateOptions, setPrinterModel } = useReceiptConfig();

  const [localHeader, setLocalHeader] = useState(config.header);
  const [localFooter, setLocalFooter] = useState(config.footer);
  const [localOptions, setLocalOptions] = useState(config.options);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalHeader(config.header);
    setLocalFooter(config.footer);
    setLocalOptions(config.options);
  }, [config]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateHeader(localHeader);
      await updateFooter(localFooter);
      await updateOptions(localOptions);
      setHasChanges(false);
      Alert.alert(t('common.success'), t('settings.receipt.saveSuccess'));
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('settings.receipt.saveError'));
    } finally {
      setIsSaving(false);
    }
  }, [localHeader, localFooter, localOptions, updateHeader, updateFooter, updateOptions, t]);

  const handlePrinterModelChange = useCallback(
    async (model: PrinterModelType) => {
      try {
        await setPrinterModel(model);
        Alert.alert(
          t('common.success'),
          t('settings.receipt.printerModelSet', { model: PRINTER_MODELS.find(m => m.value === model)?.label })
        );
      } catch (err) {
        Alert.alert(t('common.error'), err instanceof Error ? err.message : t('settings.receipt.saveError'));
      }
    },
    [setPrinterModel, t]
  );

  const updateLocalHeader = (updates: Partial<typeof localHeader>) => {
    setLocalHeader(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateLocalFooter = (updates: Partial<typeof localFooter>) => {
    setLocalFooter(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateLocalOptions = (updates: Partial<typeof localOptions>) => {
    setLocalOptions(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={lightColors.primary} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <PrinterModelSection selectedModel={config.printerModel.type} onModelChange={model => void handlePrinterModelChange(model)} />

      <ReceiptPrintOptionsSection options={localOptions} onChange={updateLocalOptions} />

      <ReceiptHeaderForm header={localHeader} onChange={updateLocalHeader} />

      <ReceiptFooterForm footer={localFooter} onChange={updateLocalFooter} />

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!hasChanges || isSaving}
      >
        <Text style={styles.saveButtonText}>{isSaving ? t('settings.receipt.saving') : t('settings.scanner.saveChanges')}</Text>
      </TouchableOpacity>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.spacer} />
    </ScrollView>
  );
};

export default ReceiptSettingsTab;
