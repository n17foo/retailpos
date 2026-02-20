import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useScannerSettings, ScannerSettings } from '../../hooks/useScannerSettings';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import { Button } from '../../components/Button';
import { useTranslate } from '../../hooks/useTranslate';

const SCANNER_TYPE_KEYS = [
  { value: 'camera', labelKey: 'settings.scanner.camera' },
  { value: 'bluetooth', labelKey: 'settings.scanner.bluetooth' },
  { value: 'usb', labelKey: 'settings.scanner.usb' },
  { value: 'qr_hardware', labelKey: 'settings.scanner.qrHardware' },
] as const;

const ScannerSettingsTab: React.FC = () => {
  const { t } = useTranslate();
  const { scannerSettings, handleScannerSettingsChange, saveSettings, testConnection, isLoading, error, saveStatus, loadSettings } =
    useScannerSettings();

  // Local state for form values
  const [formValues, setFormValues] = useState<ScannerSettings>(scannerSettings);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const load = async () => {
      await loadSettings();
    };
    load();
  }, [loadSettings]);

  // Update form values when scannerSettings change
  useEffect(() => {
    setFormValues(scannerSettings);
  }, [scannerSettings]);

  // Handle input changes
  const handleInputChange = useCallback((field: keyof ScannerSettings, value: ScannerSettings[keyof ScannerSettings]) => {
    setFormValues(prev => ({
      ...prev,
      [field]: value,
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    try {
      await saveSettings(formValues);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to save scanner settings:', err);
      Alert.alert(t('common.error'), t('settings.scanner.saveError'));
    }
  }, [formValues, saveSettings]);

  // Handle test connection
  const handleTestConnection = useCallback(async () => {
    try {
      const success = await testConnection(formValues);
      if (success) {
        Alert.alert(t('common.success'), t('settings.scanner.connectionSuccess'));
      } else {
        Alert.alert(t('common.error'), t('settings.scanner.connectionError'));
      }
    } catch (err) {
      console.error('Scanner connection test failed:', err);
      Alert.alert(t('common.error'), t('settings.scanner.connectionTestError'));
    }
  }, [testConnection, formValues]);

  // Reset form to saved values
  const handleCancel = useCallback(() => {
    setFormValues(scannerSettings);
    setHasUnsavedChanges(false);
  }, [scannerSettings]);
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a84ff" />
        <Text style={styles.loadingText}>{t('settings.scanner.loadingScanner')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>{t('settings.scanner.title')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('settings.scanner.deviceId')}</Text>
            <TextInput
              style={styles.input}
              value={formValues.deviceId}
              onChangeText={value => handleInputChange('deviceId', value)}
              placeholder={t('settings.scanner.deviceIdPlaceholder')}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('settings.scanner.scannerType')}</Text>
            <View style={styles.typeSelector}>
              {SCANNER_TYPE_KEYS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.typeOption, formValues.type === option.value && styles.typeOptionActive, isLoading && styles.disabled]}
                  onPress={() => handleInputChange('type', option.value)}
                  disabled={isLoading}
                >
                  <Text style={[styles.typeOptionText, formValues.type === option.value && styles.typeOptionTextActive]}>
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {formValues.type === 'qr_hardware' && <Text style={styles.typeHint}>{t('settings.scanner.qrHardwareHint')}</Text>}
            {formValues.type === 'camera' && <Text style={styles.typeHint}>{t('settings.scanner.cameraHint')}</Text>}
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.label}>{t('settings.scanner.enableScanner')}</Text>
            <TouchableOpacity
              style={[styles.toggleButton, formValues.enabled ? styles.toggleActive : styles.toggleInactive, isLoading && styles.disabled]}
              onPress={() => handleInputChange('enabled', !formValues.enabled)}
              disabled={isLoading}
            >
              <Text style={styles.toggleText}>{formValues.enabled ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.buttonGroup}>
            <Button
              title={t('settings.payment.testConnection')}
              variant="secondary"
              loading={isLoading}
              disabled={isLoading}
              onPress={handleTestConnection}
              style={styles.button}
            />

            {hasUnsavedChanges && (
              <View style={styles.saveButtonsContainer}>
                <Button title={t('common.cancel')} variant="outline" disabled={isLoading} onPress={handleCancel} style={styles.button} />

                <Button
                  title={t('settings.scanner.saveChanges')}
                  variant="success"
                  loading={isLoading}
                  disabled={isLoading || !hasUnsavedChanges}
                  onPress={handleSave}
                  style={styles.button}
                />
              </View>
            )}

            {saveStatus === 'saved' && (
              <View style={styles.statusContainer}>
                <Text style={styles.successText}>{t('settings.payment.settingsSaved')}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  scrollContent: {
    padding: spacing.md,
  },
  settingsSection: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  optionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.md,
  },
  buttonGroup: {
    marginTop: spacing.lg,
  },
  saveButtonsContainer: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  // Typography
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semiBold as '600',
    marginBottom: spacing.lg,
    color: lightColors.textPrimary,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as '500',
    marginBottom: spacing.xs,
    color: lightColors.textSecondary,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  buttonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium as '500',
  },
  errorText: {
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
  },
  successText: {
    color: lightColors.success,
    fontSize: typography.fontSize.sm,
    textAlign: 'center' as const,
  },

  // Form Elements
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
    backgroundColor: lightColors.background,
  },
  toggleButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    minWidth: 80,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  toggleActive: {
    backgroundColor: lightColors.primary,
  },
  toggleInactive: {
    backgroundColor: lightColors.divider,
  },
  toggleText: {
    color: lightColors.textOnPrimary,
    fontWeight: typography.fontWeight.medium as '500',
  },
  toggleTextInactive: {
    color: lightColors.textSecondary,
  },
  disabled: {
    opacity: 0.6,
  },

  // Buttons
  button: {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.sm,
    ...elevation.low,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  testButton: {
    backgroundColor: lightColors.primary,
  },
  saveButton: {
    backgroundColor: lightColors.success,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: lightColors.error,
    flex: 1,
  },

  // Status & Feedback
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing.lg,
  },
  errorContainer: {
    backgroundColor: `${lightColors.error}15`,
    borderLeftWidth: 4,
    borderLeftColor: lightColors.error,
    padding: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  statusContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: `${lightColors.success}15`,
    borderRadius: borderRadius.sm,
  },

  // Type Selector
  typeSelector: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.xs,
  },
  typeOption: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.background,
  },
  typeOptionActive: {
    backgroundColor: lightColors.primary,
    borderColor: lightColors.primary,
  },
  typeOptionText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  typeOptionTextActive: {
    color: lightColors.textOnPrimary,
    fontWeight: typography.fontWeight.medium as '500',
  },
  typeHint: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: 'italic' as const,
  },
});

export default ScannerSettingsTab;
