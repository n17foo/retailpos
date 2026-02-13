import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { posConfig } from '../../services/config/POSConfigService';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../utils/theme';

const CURRENCY_OPTIONS = [
  { symbol: '£', label: 'GBP (£)' },
  { symbol: '$', label: 'USD ($)' },
  { symbol: '€', label: 'EUR (€)' },
  { symbol: '¥', label: 'JPY (¥)' },
  { symbol: 'A$', label: 'AUD (A$)' },
  { symbol: 'C$', label: 'CAD (C$)' },
  { symbol: 'Fr', label: 'CHF (Fr)' },
];

const POSConfigSettingsTab: React.FC = () => {
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('£');
  const [maxSyncRetries, setMaxSyncRetries] = useState('3');
  const [drawerOpenOnCash, setDrawerOpenOnCash] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const cfg = posConfig.values;
    if (cfg.storeName) setStoreName(cfg.storeName);
    if (cfg.storeAddress) setStoreAddress(cfg.storeAddress);
    if (cfg.storePhone) setStorePhone(cfg.storePhone);
    if (cfg.taxRate !== undefined) setTaxRate(String(Math.round(cfg.taxRate * 10000) / 100));
    if (cfg.currencySymbol) setCurrencySymbol(cfg.currencySymbol);
    if (cfg.maxSyncRetries !== undefined) setMaxSyncRetries(String(cfg.maxSyncRetries));
    if (cfg.drawerOpenOnCash !== undefined) setDrawerOpenOnCash(cfg.drawerOpenOnCash);
  }, []);

  const markDirty = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (value: T) => {
      setter(value);
      setDirty(true);
    };
  }, []);

  const handleSave = async () => {
    if (!storeName.trim()) {
      Alert.alert('Required', 'Store name cannot be empty.');
      return;
    }
    const rate = parseFloat(taxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert('Invalid', 'Tax rate must be between 0 and 100.');
      return;
    }

    setSaving(true);
    try {
      await posConfig.updateAll({
        storeName: storeName.trim(),
        storeAddress: storeAddress.trim(),
        storePhone: storePhone.trim(),
        taxRate: rate / 100,
        currencySymbol,
        maxSyncRetries: parseInt(maxSyncRetries, 10) || 3,
        drawerOpenOnCash,
      });
      setDirty(false);
      Alert.alert('Saved', 'POS configuration updated.');
    } catch (err) {
      Alert.alert('Error', 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Store Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Store Information</Text>

        <Text style={styles.label}>Store Name</Text>
        <TextInput
          style={styles.input}
          value={storeName}
          onChangeText={markDirty(setStoreName)}
          placeholder="Store name"
          placeholderTextColor={lightColors.textSecondary}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={storeAddress}
          onChangeText={markDirty(setStoreAddress)}
          placeholder="Address"
          placeholderTextColor={lightColors.textSecondary}
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={storePhone}
          onChangeText={markDirty(setStorePhone)}
          placeholder="Phone number"
          placeholderTextColor={lightColors.textSecondary}
          keyboardType="phone-pad"
        />
      </View>

      {/* Tax & Currency */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tax &amp; Currency</Text>

        <Text style={styles.label}>Tax Rate (%)</Text>
        <TextInput
          style={styles.input}
          value={taxRate}
          onChangeText={markDirty(setTaxRate)}
          placeholder="e.g. 20"
          placeholderTextColor={lightColors.textSecondary}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Currency</Text>
        <View style={styles.currencyGrid}>
          {CURRENCY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.symbol}
              style={[styles.currencyOption, currencySymbol === opt.symbol && styles.currencyOptionActive]}
              onPress={() => {
                setCurrencySymbol(opt.symbol);
                setDirty(true);
              }}
            >
              <Text style={[styles.currencyText, currencySymbol === opt.symbol && styles.currencyTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Advanced */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced</Text>

        <Text style={styles.label}>Max Sync Retries</Text>
        <TextInput
          style={styles.input}
          value={maxSyncRetries}
          onChangeText={markDirty(setMaxSyncRetries)}
          placeholder="3"
          placeholderTextColor={lightColors.textSecondary}
          keyboardType="number-pad"
        />

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.label}>Open drawer on cash payment</Text>
          </View>
          <Switch
            value={drawerOpenOnCash}
            onValueChange={v => {
              setDrawerOpenOnCash(v);
              setDirty(true);
            }}
            trackColor={{ false: lightColors.border, true: lightColors.primary + '60' }}
            thumbColor={drawerOpenOnCash ? lightColors.primary : lightColors.textSecondary}
          />
        </View>
      </View>

      {/* Save */}
      {dirty && (
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  section: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.background,
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  currencyOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.background,
  },
  currencyOptionActive: {
    borderColor: lightColors.primary,
    backgroundColor: lightColors.primary + '15',
  },
  currencyText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
  currencyTextActive: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  switchLabel: {
    flex: 1,
    marginRight: spacing.md,
  },
  saveButton: {
    backgroundColor: lightColors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontWeight: '600',
  },
});

export default POSConfigSettingsTab;
