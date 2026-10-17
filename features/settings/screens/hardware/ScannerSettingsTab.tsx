import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../../shared/contexts/ThemeProvider';
import { Input } from '../../../../shared/components/Input';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { scannerSettingsService, BLE_SCANNER_PRESETS, BleScannerPreset } from '../../../hardware/services/scanner/ScannerSettingsService';

/**
 * Scanner settings tab for configuring barcode scanners
 */
export function ScannerSettingsTab() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // BLE Settings
  const [blePreset, setBlePreset] = useState<BleScannerPreset>('microchip_rn4020');
  const [bleServiceUUID, setBleServiceUUID] = useState('');
  const [bleCharUUID, setBleCharUUID] = useState('');
  const [deviceNamePatterns, setDeviceNamePatterns] = useState('');

  // USB Settings
  const [scanIntervalMs, setScanIntervalMs] = useState('80');
  const [minBarcodeLength, setMinBarcodeLength] = useState('3');
  const [maxBarcodeLength, setMaxBarcodeLength] = useState('128');
  const [suffixChar, setSuffixChar] = useState<'Enter' | 'Tab'>('Enter');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      await scannerSettingsService.initialize();
      const settings = scannerSettingsService.getSettings();

      setBlePreset(settings.bluetooth.preset);
      setBleServiceUUID(settings.bluetooth.serviceUUID);
      setBleCharUUID(settings.bluetooth.characteristicUUID);
      setDeviceNamePatterns(settings.bluetooth.deviceNamePatterns.join(', '));

      setScanIntervalMs(settings.usb.scanIntervalMs.toString());
      setMinBarcodeLength(settings.usb.minBarcodeLength.toString());
      setMaxBarcodeLength(settings.usb.maxBarcodeLength.toString());
      setSuffixChar(settings.usb.suffixChar);
    } catch {
      Alert.alert('Error', 'Failed to load scanner settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (preset: BleScannerPreset) => {
    setBlePreset(preset);
    const presetConfig = BLE_SCANNER_PRESETS[preset];
    setBleServiceUUID(presetConfig.serviceUUID);
    setBleCharUUID(presetConfig.characteristicUUID);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await scannerSettingsService.updateSettings({
        bluetooth: {
          preset: blePreset,
          serviceUUID: bleServiceUUID,
          characteristicUUID: bleCharUUID,
          deviceNamePatterns: deviceNamePatterns
            .split(',')
            .map(p => p.trim())
            .filter(Boolean),
        },
        usb: {
          scanIntervalMs: parseInt(scanIntervalMs, 10),
          minBarcodeLength: parseInt(minBarcodeLength, 10),
          maxBarcodeLength: parseInt(maxBarcodeLength, 10),
          suffixChar,
        },
      });

      setDirty(false);
      Alert.alert('Success', 'Scanner settings saved successfully');
    } catch {
      Alert.alert('Error', 'Failed to save scanner settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Bluetooth Scanner Settings */}
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bluetooth Scanner</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Configure BLE GATT UUIDs for your barcode scanner model
        </Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Scanner Model Preset</Text>
          <View style={styles.presetButtons}>
            {(Object.keys(BLE_SCANNER_PRESETS) as BleScannerPreset[]).map(preset => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetButton,
                  { borderColor: colors.border },
                  blePreset === preset && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => handlePresetChange(preset)}
              >
                <Text style={[styles.presetButtonText, { color: blePreset === preset ? colors.textOnPrimary : colors.textPrimary }]}>
                  {BLE_SCANNER_PRESETS[preset].name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Input
          label="Service UUID"
          value={bleServiceUUID}
          onChangeText={text => {
            setBleServiceUUID(text);
            setDirty(true);
          }}
          placeholder="00000000-0000-0000-0000-000000000000"
          editable={blePreset === 'custom'}
        />

        <Input
          label="Characteristic UUID"
          value={bleCharUUID}
          onChangeText={text => {
            setBleCharUUID(text);
            setDirty(true);
          }}
          placeholder="00000000-0000-0000-0000-000000000000"
          editable={blePreset === 'custom'}
        />

        <Input
          label="Device Name Patterns (comma-separated)"
          value={deviceNamePatterns}
          onChangeText={text => {
            setDeviceNamePatterns(text);
            setDirty(true);
          }}
          placeholder="scanner, barcode, zebra, honeywell"
          helperText="Leave empty to show all BLE devices during discovery. Common patterns: scanner, barcode, reader, zebra, honeywell, socket, cs4070, 1902, s700"
        />
      </Card>

      {/* USB Scanner Settings */}
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>USB Scanner</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Configure scan detection thresholds for USB HID scanners
        </Text>

        <Input
          label="Scan Interval (ms)"
          value={scanIntervalMs}
          onChangeText={text => {
            setScanIntervalMs(text);
            setDirty(true);
          }}
          keyboardType="numeric"
          helperText="Max time between keystrokes to consider part of same scan (default: 80ms)"
        />

        <Input
          label="Minimum Barcode Length"
          value={minBarcodeLength}
          onChangeText={text => {
            setMinBarcodeLength(text);
            setDirty(true);
          }}
          keyboardType="numeric"
          helperText="Reject scans shorter than this (default: 3)"
        />

        <Input
          label="Maximum Barcode Length"
          value={maxBarcodeLength}
          onChangeText={text => {
            setMaxBarcodeLength(text);
            setDirty(true);
          }}
          keyboardType="numeric"
          helperText="Reject scans longer than this (default: 128)"
        />

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Suffix Character</Text>
          <View style={styles.suffixButtons}>
            <TouchableOpacity
              style={[
                styles.suffixButton,
                { borderColor: colors.border },
                suffixChar === 'Enter' && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => {
                setSuffixChar('Enter');
                setDirty(true);
              }}
            >
              <Text style={[styles.suffixButtonText, { color: suffixChar === 'Enter' ? colors.textOnPrimary : colors.textPrimary }]}>
                Enter
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.suffixButton,
                { borderColor: colors.border },
                suffixChar === 'Tab' && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => {
                setSuffixChar('Tab');
                setDirty(true);
              }}
            >
              <Text style={[styles.suffixButtonText, { color: suffixChar === 'Tab' ? colors.textOnPrimary : colors.textPrimary }]}>
                Tab
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      {/* Save Button */}
      {dirty && <Button title={saving ? 'Saving...' : 'Save Settings'} onPress={handleSave} disabled={saving} style={styles.saveButton} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  suffixButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  suffixButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  suffixButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 8,
  },
});
