import React, { useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Button } from 'react-native';
import { usePrinterSettings, PrinterSettings } from '../../hooks/usePrinterSettings';
import { PrinterConnectionType } from '../../services/printer/UnifiedPrinterService';

interface PrinterSetupStepProps {
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
}

const PrinterSetupStep: React.FC<PrinterSetupStepProps> = ({ onBack, onNext, onSkip }) => {
  const { printerSettings, handlePrinterSettingsChange, testConnection, loadSettings, saveSettings, isLoading } = usePrinterSettings();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(
    (updates: Partial<PrinterSettings>) => {
      handlePrinterSettingsChange({ ...printerSettings, ...updates });
    },
    [printerSettings, handlePrinterSettingsChange]
  );

  const validateSettings = () => {
    const { connectionType, printerName, vendorId, productId, macAddress, ipAddress, port } = printerSettings;

    if (!printerName?.trim()) {
      Alert.alert('Validation Error', 'Printer name is required.');
      return false;
    }

    switch (connectionType) {
      case PrinterConnectionType.USB:
        if (vendorId === undefined || productId === undefined) {
          Alert.alert('Validation Error', 'Vendor ID and Product ID are required for USB printers.');
          return false;
        }
        break;
      case PrinterConnectionType.BLUETOOTH:
        if (!macAddress?.match(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)) {
          Alert.alert('Validation Error', 'Invalid MAC address format.');
          return false;
        }
        break;
      case PrinterConnectionType.NETWORK:
        if (!ipAddress?.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
          Alert.alert('Validation Error', 'Invalid IP address format.');
          return false;
        }
        if (!port || port < 1 || port > 65535) {
          Alert.alert('Validation Error', 'Port must be between 1 and 65535.');
          return false;
        }
        break;
    }

    return true;
  };

  const handleNextPress = async () => {
    if (validateSettings()) {
      await saveSettings(printerSettings);
      onNext();
    }
  };

  const handleTestConnection = async () => {
    const success = await testConnection(printerSettings);
    Alert.alert(success ? 'Success' : 'Failure', `Connection test ${success ? 'succeeded' : 'failed'}.`);
  };

  const renderConnectionSettings = () => {
    switch (printerSettings.connectionType) {
      case PrinterConnectionType.USB:
        return (
          <View>
            <TextInput
              style={styles.input}
              value={printerSettings.vendorId?.toString(16) || ''}
              onChangeText={text => updateSettings({ vendorId: parseInt(text, 16) || undefined })}
              placeholder="USB Vendor ID (hex)"
            />
            <TextInput
              style={styles.input}
              value={printerSettings.productId?.toString(16) || ''}
              onChangeText={text => updateSettings({ productId: parseInt(text, 16) || undefined })}
              placeholder="USB Product ID (hex)"
            />
          </View>
        );
      case PrinterConnectionType.BLUETOOTH:
        return (
          <TextInput
            style={styles.input}
            value={printerSettings.macAddress || ''}
            onChangeText={text => updateSettings({ macAddress: text })}
            placeholder="Bluetooth MAC address"
          />
        );
      case PrinterConnectionType.NETWORK:
        return (
          <View>
            <TextInput
              style={styles.input}
              value={printerSettings.ipAddress || ''}
              onChangeText={text => updateSettings({ ipAddress: text })}
              placeholder="Printer IP address"
            />
            <TextInput
              style={styles.input}
              value={printerSettings.port?.toString() || ''}
              onChangeText={text => updateSettings({ port: parseInt(text, 10) || undefined })}
              placeholder="Port number"
              keyboardType="numeric"
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Configure Receipt Printer</Text>
      <Text style={styles.subtitle}>Set up your hardware for printing receipts.</Text>

      {isLoading && <ActivityIndicator size="large" />}

      {!isLoading && (
        <>
          <TextInput
            style={styles.input}
            value={printerSettings.printerName || ''}
            onChangeText={text => updateSettings({ printerName: text })}
            placeholder="Printer Name (e.g., Kitchen Printer)"
          />
          <View style={styles.radioGroup}>
            {Object.values(PrinterConnectionType).map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.radioButton, printerSettings.connectionType === type && styles.radioButtonSelected]}
                onPress={() => updateSettings({ connectionType: type })}
              >
                <Text>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {renderConnectionSettings()}
          <Button title="Test Connection" onPress={handleTestConnection} />
        </>
      )}

      <View style={styles.buttonContainer}>
        <Button title="Back" onPress={onBack} />
        {onSkip && <Button title="Skip" onPress={onSkip} />}
        <Button title="Next" onPress={handleNextPress} disabled={isLoading} />
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
    marginBottom: 20,
    textAlign: 'center',
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  radioButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginHorizontal: 5,
  },
  radioButtonSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
});

export default PrinterSetupStep;
