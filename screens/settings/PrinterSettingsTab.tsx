import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { PrinterConnectionType } from '../../services/printer/UnifiedPrinterService';
import { usePrinterSettings, PrinterSettings } from '../../hooks/usePrinterSettings';
import { useTranslate } from '../../hooks/useTranslate';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import { Button, Input } from '../../components';

// Helper function to create a deep copy of the settings object
const deepCopy = (obj: any) => JSON.parse(JSON.stringify(obj));

const PrinterSettingsTab: React.FC = () => {
  const { t } = useTranslate();

  // Use the printer settings hook
  const {
    printerSettings,
    handlePrinterSettingsChange,
    testConnection,
    loadSettings,
    saveSettings,
    validateSettings,
    isLoading,
    isTesting,
    error,
    saveStatus,
  } = usePrinterSettings();

  // Local state to track if we have unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track if we've already initialized
  const initialized = useRef(false);

  // Store original settings for reset functionality
  const originalSettings = useRef(deepCopy(printerSettings));

  // Load settings only once on mount
  useEffect(() => {
    const init = async () => {
      if (!initialized.current) {
        console.log('Initializing PrinterSettingsTab');
        await loadSettings();
        initialized.current = true;
      }
    };

    init();
  }, [loadSettings]);

  // Update original settings when printer settings change
  useEffect(() => {
    if (initialized.current) {
      console.log('Printer settings updated');
      originalSettings.current = deepCopy(printerSettings);
      setHasUnsavedChanges(false);
    }
  }, [printerSettings]);

  // Save changes handler
  const saveChanges = useCallback(async () => {
    if (hasUnsavedChanges) {
      console.log('Saving printer settings changes');
      await saveSettings(printerSettings);
    }
  }, [printerSettings, hasUnsavedChanges, saveSettings]);

  // Cancel changes handler
  const cancelChanges = useCallback(() => {
    console.log('Cancelling printer settings changes');
    handlePrinterSettingsChange(deepCopy(originalSettings.current));
    setHasUnsavedChanges(false);
  }, [handlePrinterSettingsChange]);

  // Update settings and mark as changed
  const updateSettings = useCallback(
    (updates: Partial<PrinterSettings>) => {
      handlePrinterSettingsChange({
        ...printerSettings,
        ...updates,
      });
      setHasUnsavedChanges(true);
    },
    [printerSettings, handlePrinterSettingsChange]
  );

  const handleTestConnection = useCallback(async () => {
    try {
      console.log('Testing printer connection');
      const success = await testConnection(printerSettings);
      const showTestConnectionSuccess = () => {
        Alert.alert(
          t('settings.printer.testConnectionSuccessTitle', 'Connection Successful'),
          t('settings.printer.testConnectionSuccess', 'Successfully connected to the printer'),
          [{ text: t('common.ok', 'OK') }]
        );
      };

      const showTestConnectionError = (error: string) => {
        Alert.alert(
          t('settings.printer.testConnectionErrorTitle', 'Connection Failed'),
          t('settings.printer.testConnectionError', { error, defaultValue: `Failed to connect to printer: ${error}` }) as string,
          [{ text: t('common.ok', 'OK') }]
        );
      };

      if (success) {
        showTestConnectionSuccess();
      } else {
        showTestConnectionError('Test connection failed');
      }
    } catch (err) {
      // Error is already handled in the hook, just show the alert
      const errorMessage = err instanceof Error ? err.message : t('settings.printer.testConnectionError', 'Failed to connect to printer');

      Alert.alert(t('settings.printer.testConnectionErrorTitle', 'Connection Failed') as string, errorMessage as string);
    }
  }, [testConnection, printerSettings, t]);

  const renderConnectionSettings = useCallback(() => {
    switch (printerSettings.connectionType) {
      case PrinterConnectionType.USB:
        return (
          <View>
            <Text style={styles.sectionSubheader}>USB Settings</Text>
            <TextInput
              style={styles.input}
              value={printerSettings.vendorId?.toString(16) || ''}
              onChangeText={text =>
                updateSettings({
                  vendorId: parseInt(text, 16) || undefined,
                })
              }
              placeholder="Enter USB Vendor ID (hex)"
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              value={printerSettings.productId?.toString(16) || ''}
              onChangeText={text =>
                updateSettings({
                  productId: parseInt(text, 16) || undefined,
                })
              }
              placeholder="Enter USB Product ID (hex)"
              keyboardType="numeric"
            />
          </View>
        );
      case PrinterConnectionType.BLUETOOTH:
        return (
          <View>
            <Text style={styles.sectionSubheader}>Bluetooth Settings</Text>
            <TextInput
              style={styles.input}
              value={printerSettings.macAddress || ''}
              onChangeText={text => updateSettings({ macAddress: text })}
              placeholder="Enter Bluetooth MAC address"
            />
          </View>
        );
      case PrinterConnectionType.NETWORK:
        return (
          <View>
            <Text style={styles.sectionSubheader}>Network Settings</Text>
            <TextInput
              style={styles.input}
              value={printerSettings.ipAddress || ''}
              onChangeText={text => updateSettings({ ipAddress: text })}
              placeholder="Enter printer IP address"
            />
            <TextInput
              style={styles.input}
              value={printerSettings.port?.toString() || ''}
              onChangeText={text =>
                updateSettings({
                  port: parseInt(text, 10) || undefined,
                })
              }
              placeholder="Enter port number"
              keyboardType="numeric"
            />
          </View>
        );
      default:
        return null;
    }
  }, [printerSettings, updateSettings]);

  // Handle save with validation
  const handleSave = async () => {
    const validation = validateSettings();
    if (!validation.isValid) {
      Alert.alert(
        t('settings.printer.validationErrorTitle', 'Validation Error'),
        validation.error || t('settings.printer.validationError', 'Invalid printer settings')
      );
      return;
    }

    try {
      const success = await saveSettings(printerSettings);
      if (success) {
        Alert.alert(t('common.success', 'Success'), t('settings.printer.saveSuccess', 'Printer settings saved successfully'), [
          { text: t('common.ok', 'OK') },
        ]);
      }
    } catch (error) {
      Alert.alert(
        t('common.error', 'Error'),
        (error as Error).message || t('settings.printer.saveError', 'Failed to save printer settings')
      );
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, styles.tabContent]}>
        <ActivityIndicator size="large" color="#4a80f5" />
        <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent}>
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Printer Settings</Text>

        <Input
          label="Printer Name"
          value={printerSettings.printerName || ''}
          onChangeText={text => updateSettings({ printerName: text })}
          placeholder="Enter printer name"
        />

        <Text style={styles.sectionSubheader}>Connection Type</Text>
        <View style={styles.radioGroup}>
          {Object.values(PrinterConnectionType).map(type => (
            <TouchableOpacity key={type} style={styles.radioOption} onPress={() => updateSettings({ connectionType: type })}>
              <View style={[styles.radioButton, printerSettings.connectionType === type && styles.radioButtonSelected]}>
                {printerSettings.connectionType === type && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={[styles.radioText, printerSettings.connectionType === type && styles.radioTextSelected]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderConnectionSettings()}

        <Text style={styles.sectionSubheader}>Print Options</Text>
        <View style={styles.optionRow}>
          <Text style={styles.label}>Enable Printer</Text>
          <TouchableOpacity
            style={[styles.toggleButton, printerSettings.enabled ? styles.toggleActive : styles.toggleInactive]}
            onPress={() => updateSettings({ enabled: !printerSettings.enabled })}
          >
            <Text style={styles.toggleText}>{printerSettings.enabled ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.label}>Auto Print Receipts</Text>
          <TouchableOpacity
            style={[styles.toggleButton, printerSettings.printReceipts ? styles.toggleActive : styles.toggleInactive]}
            onPress={() => updateSettings({ printReceipts: !printerSettings.printReceipts })}
          >
            <Text style={styles.toggleText}>{printerSettings.printReceipts ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          <Button
            title={t('settings.printer.testConnection', 'Test Connection')}
            variant="secondary"
            loading={isTesting}
            disabled={isTesting}
            onPress={handleTestConnection}
            style={styles.button}
          />

          <Button
            title={t('common.save', 'Save')}
            variant="success"
            loading={saveStatus === 'saving'}
            disabled={saveStatus === 'saving' || isTesting}
            onPress={handleSave}
            style={styles.button}
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: lightColors.textSecondary,
  },
  scrollContent: {
    padding: spacing.md,
  },
  errorContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: `${lightColors.error}20`,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: lightColors.error,
  },
  errorText: {
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
  },
  tabContent: {
    flex: 1,
    padding: spacing.md,
  },
  settingsSection: {
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as '700',
    marginBottom: spacing.md,
    color: lightColors.textPrimary,
  },
  sectionSubheader: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold as '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    color: lightColors.textSecondary,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  label: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    flex: 1,
  },
  input: {
    backgroundColor: lightColors.surface,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  radioGroup: {
    marginBottom: spacing.lg,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: lightColors.primary,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: lightColors.surface,
  },
  radioButtonSelected: {
    backgroundColor: lightColors.primary,
  },
  radioText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  radioTextSelected: {
    fontWeight: typography.fontWeight.semiBold as '600',
    color: lightColors.textPrimary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
    ...elevation.low,
  },
  testButton: {
    backgroundColor: lightColors.success,
    marginRight: spacing.xs,
  },
  testButtonText: {
    color: lightColors.textOnPrimary,
  },
  saveButton: {
    backgroundColor: lightColors.primary,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: lightColors.divider,
    marginRight: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: lightColors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold as '600',
  },
  saveButtonText: {
    color: lightColors.textOnPrimary,
  },
  toggleButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  toggleActive: {
    backgroundColor: lightColors.primary,
    borderColor: lightColors.primary,
  },
  toggleInactive: {
    backgroundColor: lightColors.divider,
  },
  toggleText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textOnPrimary,
    fontWeight: typography.fontWeight.semiBold as '600',
  },
});

export default PrinterSettingsTab;
