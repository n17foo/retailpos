import React, { useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Button, Switch } from 'react-native';
import { useScannerSettings, ScannerSettings } from '../../hooks/useScannerSettings';

interface ScannerSetupStepProps {
  onBack: () => void;
  onComplete: () => void;
}

const SCANNER_TYPE_OPTIONS = [
  { value: 'camera', label: 'Camera' },
  { value: 'bluetooth', label: 'Bluetooth' },
  { value: 'usb', label: 'USB' },
  { value: 'qr_hardware', label: 'QR Hardware' },
] as const;

const ScannerSetupStep: React.FC<ScannerSetupStepProps> = ({ onBack, onComplete }) => {
  const { scannerSettings, handleScannerSettingsChange, saveSettings, testConnection, isLoading, loadSettings } = useScannerSettings();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleInputChange = useCallback(
    (field: keyof ScannerSettings, value: ScannerSettings[keyof ScannerSettings]) => {
      handleScannerSettingsChange({ ...scannerSettings, [field]: value });
    },
    [scannerSettings, handleScannerSettingsChange]
  );

  const validateSettings = () => {
    const { enabled, type, deviceId } = scannerSettings;
    if (enabled) {
      if (!type?.trim()) {
        Alert.alert('Validation Error', 'Scanner type is required when the scanner is enabled.');
        return false;
      }
      if (type.toLowerCase() !== 'camera' && !deviceId?.trim()) {
        Alert.alert('Validation Error', 'Device ID is required for this scanner type.');
        return false;
      }
    }
    return true;
  };

  const handleComplete = async () => {
    if (validateSettings()) {
      await saveSettings(scannerSettings);
      onComplete();
    }
  };

  const handleTestConnection = async () => {
    const success = await testConnection(scannerSettings);
    Alert.alert(success ? 'Success' : 'Failure', `Scanner connection test ${success ? 'succeeded' : 'failed'}.`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Configure Scanner</Text>
      <Text style={styles.subtitle}>Set up your device for scanning barcodes and QR codes.</Text>

      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <View style={styles.formContainer}>
          <View style={styles.optionRow}>
            <Text style={styles.label}>Enable Scanner</Text>
            <Switch value={scannerSettings.enabled} onValueChange={value => handleInputChange('enabled', value)} />
          </View>

          <Text style={styles.label}>Scanner Type</Text>
          <View style={styles.typeSelector}>
            {SCANNER_TYPE_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.typeOption,
                  scannerSettings.type === option.value && styles.typeOptionActive,
                  !scannerSettings.enabled && styles.typeOptionDisabled,
                ]}
                onPress={() => handleInputChange('type', option.value)}
                disabled={!scannerSettings.enabled}
              >
                <Text style={[styles.typeOptionText, scannerSettings.type === option.value && styles.typeOptionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {scannerSettings.type === 'qr_hardware' && (
            <Text style={styles.typeHint}>
              Dedicated QR code reader (USB/Bluetooth). Required for desktop apps where camera is unavailable.
            </Text>
          )}
          {scannerSettings.type === 'camera' && (
            <Text style={styles.typeHint}>Uses device camera. Available on mobile and tablet only.</Text>
          )}

          {scannerSettings.type !== 'camera' && (
            <>
              <Text style={styles.label}>Device ID</Text>
              <TextInput
                style={styles.input}
                value={scannerSettings.deviceId}
                onChangeText={value => handleInputChange('deviceId', value)}
                placeholder="Enter device ID"
                editable={scannerSettings.enabled}
              />
            </>
          )}
          <Button title="Test Connection" onPress={handleTestConnection} disabled={!scannerSettings.enabled} />
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button title="Back" onPress={onBack} />
        <Button title="Finish Onboarding" onPress={handleComplete} disabled={isLoading} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    justifyContent: 'center',
    flexGrow: 1,
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
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
    marginBottom: 40,
    textAlign: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  typeSelector: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 20,
  },
  typeOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f9f9f9',
  },
  typeOptionActive: {
    backgroundColor: '#0a84ff',
    borderColor: '#0a84ff',
  },
  typeOptionDisabled: {
    opacity: 0.5,
  },
  typeOptionText: {
    fontSize: 14,
    color: '#666',
  },
  typeOptionTextActive: {
    color: '#fff',
    fontWeight: '500' as const,
  },
  typeHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
    fontStyle: 'italic' as const,
  },
});

export default ScannerSetupStep;
