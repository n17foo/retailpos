import React, { useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Button, Switch } from 'react-native';
import { useScannerSettings, ScannerSettings } from '../../hooks/useScannerSettings';

interface ScannerSetupStepProps {
  onBack: () => void;
  onComplete: () => void;
}

const ScannerSetupStep: React.FC<ScannerSetupStepProps> = ({ onBack, onComplete }) => {
  const { scannerSettings, handleScannerSettingsChange, saveSettings, testConnection, isLoading, loadSettings } = useScannerSettings();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleInputChange = useCallback(
    (field: keyof ScannerSettings, value: any) => {
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
      <Text style={styles.title}>Configure Barcode Scanner</Text>
      <Text style={styles.subtitle}>Set up your device for scanning products.</Text>

      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <View style={styles.formContainer}>
          <View style={styles.optionRow}>
            <Text style={styles.label}>Enable Scanner</Text>
            <Switch value={scannerSettings.enabled} onValueChange={value => handleInputChange('enabled', value)} />
          </View>

          <Text style={styles.label}>Scanner Type</Text>
          <TextInput
            style={styles.input}
            value={scannerSettings.type}
            onChangeText={value => handleInputChange('type', value)}
            placeholder="e.g., bluetooth, usb"
            editable={scannerSettings.enabled}
          />

          <Text style={styles.label}>Device ID</Text>
          <TextInput
            style={styles.input}
            value={scannerSettings.deviceId}
            onChangeText={value => handleInputChange('deviceId', value)}
            placeholder="Enter device ID"
            editable={scannerSettings.enabled}
          />
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
});

export default ScannerSetupStep;
