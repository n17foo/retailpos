import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useScannerSettings, ScannerSettings } from '../../hooks/useScannerSettings';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import { Button } from '../../components/Button';

const SCANNER_TYPE_OPTIONS = [
  { value: 'camera', label: 'Camera' },
  { value: 'bluetooth', label: 'Bluetooth' },
  { value: 'usb', label: 'USB' },
  { value: 'qr_hardware', label: 'QR Hardware' },
] as const;

const ScannerSettingsTab: React.FC = () => {
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
      Alert.alert('Error', 'Failed to save scanner settings');
    }
  }, [formValues, saveSettings]);

  // Handle test connection
  const handleTestConnection = useCallback(async () => {
    try {
      const success = await testConnection(formValues);
      if (success) {
        Alert.alert('Success', 'Scanner connection test successful!');
      } else {
        Alert.alert('Error', 'Failed to connect to scanner. Please check your settings.');
      }
    } catch (err) {
      console.error('Scanner connection test failed:', err);
      Alert.alert('Error', 'An error occurred while testing the scanner connection');
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
        <Text style={styles.loadingText}>Loading scanner settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Scanner Settings</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Scanner Device ID</Text>
            <TextInput
              style={styles.input}
              value={formValues.deviceId}
              onChangeText={value => handleInputChange('deviceId', value)}
              placeholder="Enter device ID"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Scanner Type</Text>
            <View style={styles.typeSelector}>
              {SCANNER_TYPE_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.typeOption, formValues.type === option.value && styles.typeOptionActive, isLoading && styles.disabled]}
                  onPress={() => handleInputChange('type', option.value)}
                  disabled={isLoading}
                >
                  <Text style={[styles.typeOptionText, formValues.type === option.value && styles.typeOptionTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {formValues.type === 'qr_hardware' && (
              <Text style={styles.typeHint}>
                Dedicated QR code reader for desktop apps (USB or Bluetooth). Required when camera is not available.
              </Text>
            )}
            {formValues.type === 'camera' && (
              <Text style={styles.typeHint}>Uses device camera for barcode and QR scanning. Available on mobile and tablet only.</Text>
            )}
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.label}>Enable Scanner</Text>
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
              title="Test Connection"
              variant="secondary"
              loading={isLoading}
              disabled={isLoading}
              onPress={handleTestConnection}
              style={styles.button}
            />

            {hasUnsavedChanges && (
              <View style={styles.saveButtonsContainer}>
                <Button title="Cancel" variant="outline" disabled={isLoading} onPress={handleCancel} style={styles.button} />

                <Button
                  title="Save Changes"
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
                <Text style={styles.successText}>Settings saved successfully!</Text>
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
