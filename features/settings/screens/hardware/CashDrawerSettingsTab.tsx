import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../shared/contexts/ThemeProvider';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { keyValueRepository } from '../../../../shared/repositories/KeyValueRepository';

const DRAWER_SETTINGS_KEY = 'cashDrawerSettings';

interface DrawerSettings {
  pin: 2 | 5;
  openOnCash: boolean;
}

/**
 * Cash drawer settings tab
 */
export function CashDrawerSettingsTab() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pin, setPin] = useState<2 | 5>(2);
  const [openOnCash, setOpenOnCash] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await keyValueRepository.getObject<DrawerSettings>(DRAWER_SETTINGS_KEY);
      if (saved) {
        setPin(saved.pin);
        setOpenOnCash(saved.openOnCash);
      }
    } catch {
      Alert.alert('Error', 'Failed to load drawer settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await keyValueRepository.setObject(DRAWER_SETTINGS_KEY, { pin, openOnCash });
      setDirty(false);
      Alert.alert('Success', 'Cash drawer settings saved');
    } catch {
      Alert.alert('Error', 'Failed to save settings');
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
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Cash Drawer Configuration</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Configure which RJ-11 pin to use for the drawer kick pulse
        </Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Drawer Kick Pin</Text>
          <View style={styles.pinButtons}>
            <TouchableOpacity
              style={[
                styles.pinButton,
                { borderColor: colors.border },
                pin === 2 && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => {
                setPin(2);
                setDirty(true);
              }}
            >
              <Text style={[styles.pinButtonText, { color: pin === 2 ? colors.textOnPrimary : colors.textPrimary }]}>Pin 2</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pinButton,
                { borderColor: colors.border },
                pin === 5 && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => {
                setPin(5);
                setDirty(true);
              }}
            >
              <Text style={[styles.pinButtonText, { color: pin === 5 ? colors.textOnPrimary : colors.textPrimary }]}>Pin 5</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            Most cash drawers use Pin 2. Check your drawer manual if unsure.
          </Text>
        </View>

        <View style={styles.field}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => {
              setOpenOnCash(!openOnCash);
              setDirty(true);
            }}
          >
            <View style={[styles.checkbox, { borderColor: colors.border }]}>
              {openOnCash && <View style={[styles.checkboxInner, { backgroundColor: colors.primary }]} />}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.textPrimary }]}>Automatically open drawer on cash payments</Text>
          </TouchableOpacity>
        </View>
      </Card>

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
  pinButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  pinButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  pinButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  saveButton: {
    marginTop: 8,
  },
});
