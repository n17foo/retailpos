import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { posConfig } from '../../services/config/POSConfigService';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../utils/theme';
import { getCurrencyOptions } from '../../utils/currency';
import { useTranslate } from '../../hooks/useTranslate';

const POSConfigSettingsTab: React.FC = () => {
  const { t } = useTranslate();
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
      Alert.alert(t('common.required'), t('settings.posConfig.storeNameRequired'));
      return;
    }
    const rate = parseFloat(taxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert(t('common.invalid'), t('settings.posConfig.taxRateInvalid'));
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
      Alert.alert(t('common.saved'), t('settings.posConfig.saved'));
    } catch (err) {
      Alert.alert(t('common.error'), t('settings.posConfig.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Store Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.posConfig.storeInfo')}</Text>

        <Text style={styles.label}>{t('settings.posConfig.storeName')}</Text>
        <TextInput
          style={styles.input}
          value={storeName}
          onChangeText={markDirty(setStoreName)}
          placeholder={t('settings.posConfig.storeNamePlaceholder')}
          placeholderTextColor={lightColors.textSecondary}
        />

        <Text style={styles.label}>{t('settings.posConfig.address')}</Text>
        <TextInput
          style={styles.input}
          value={storeAddress}
          onChangeText={markDirty(setStoreAddress)}
          placeholder={t('settings.posConfig.addressPlaceholder')}
          placeholderTextColor={lightColors.textSecondary}
        />

        <Text style={styles.label}>{t('settings.posConfig.phone')}</Text>
        <TextInput
          style={styles.input}
          value={storePhone}
          onChangeText={markDirty(setStorePhone)}
          placeholder={t('settings.posConfig.phonePlaceholder')}
          placeholderTextColor={lightColors.textSecondary}
          keyboardType="phone-pad"
        />
      </View>

      {/* Tax & Currency */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.posConfig.taxCurrency')}</Text>

        <Text style={styles.label}>{t('settings.posConfig.taxRate')}</Text>
        <TextInput
          style={styles.input}
          value={taxRate}
          onChangeText={markDirty(setTaxRate)}
          placeholder={t('settings.posConfig.taxRatePlaceholder')}
          placeholderTextColor={lightColors.textSecondary}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>{t('settings.posConfig.currency')}</Text>
        <View style={styles.currencyGrid}>
          {getCurrencyOptions().map(opt => (
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
        <Text style={styles.sectionTitle}>{t('settings.posConfig.advanced')}</Text>

        <Text style={styles.label}>{t('settings.posConfig.maxSyncRetries')}</Text>
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
            <Text style={styles.label}>{t('settings.posConfig.drawerOpenOnCash')}</Text>
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
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>{t('settings.scanner.saveChanges')}</Text>
          )}
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
