import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { posConfig, DEFAULT_AUTO_LOCK_MINUTES } from '../../services/config/POSConfigService';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../utils/theme';
import { getCurrencyOptions } from '../../utils/currency';
import { useTranslate } from '../../hooks/useTranslate';
import { loyaltyService } from '../../services/loyalty/LoyaltyService';
import { storeCreditService } from '../../services/customer/StoreCreditService';

const POSConfigSettingsTab: React.FC = () => {
  const { t } = useTranslate();
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('£');
  const [maxSyncRetries, setMaxSyncRetries] = useState('3');
  const [drawerOpenOnCash, setDrawerOpenOnCash] = useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState(String(DEFAULT_AUTO_LOCK_MINUTES));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Loyalty settings
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyEarnRate, setLoyaltyEarnRate] = useState('100');
  const [loyaltyRedeemRate, setLoyaltyRedeemRate] = useState('1');
  const [loyaltyExpiryDays, setLoyaltyExpiryDays] = useState('');
  const [loyaltyTierSilver, setLoyaltyTierSilver] = useState('500');
  const [loyaltyTierGold, setLoyaltyTierGold] = useState('2000');

  // Store credit settings
  const [storeCreditEnabled, setStoreCreditEnabled] = useState(false);

  useEffect(() => {
    const cfg = posConfig.values;
    if (cfg.storeName) setStoreName(cfg.storeName);
    if (cfg.storeAddress) setStoreAddress(cfg.storeAddress);
    if (cfg.storePhone) setStorePhone(cfg.storePhone);
    if (cfg.taxRate !== undefined) setTaxRate(String(Math.round(cfg.taxRate * 10000) / 100));
    if (cfg.currencySymbol) setCurrencySymbol(cfg.currencySymbol);
    if (cfg.maxSyncRetries !== undefined) setMaxSyncRetries(String(cfg.maxSyncRetries));
    if (cfg.drawerOpenOnCash !== undefined) setDrawerOpenOnCash(cfg.drawerOpenOnCash);
    setAutoLockMinutes(String(cfg.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES));

    // Load loyalty and store credit settings
    (async () => {
      try {
        const loyaltyConfig = await loyaltyService.getConfig();
        setLoyaltyEnabled(loyaltyConfig.enabled);
        setLoyaltyEarnRate(String(loyaltyConfig.earnRate));
        setLoyaltyRedeemRate(String(loyaltyConfig.redeemRate));
        setLoyaltyExpiryDays(loyaltyConfig.expiryDays ? String(loyaltyConfig.expiryDays) : '');

        const storeCreditEnabledValue = await storeCreditService.isEnabled();
        setStoreCreditEnabled(storeCreditEnabledValue);
      } catch {
        // Use defaults
      }
    })();
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
    const lockMinutes = Number(autoLockMinutes);
    if (!Number.isInteger(lockMinutes) || lockMinutes < 0 || lockMinutes > 480) {
      Alert.alert(t('common.invalid'), 'Auto-lock must be a whole number of minutes between 0 and 480');
      return;
    }

    // Validate loyalty settings
    const earnRate = parseInt(loyaltyEarnRate, 10);
    const redeemRate = parseInt(loyaltyRedeemRate, 10);
    const expiryDays = loyaltyExpiryDays ? parseInt(loyaltyExpiryDays, 10) : null;
    const tierSilver = parseInt(loyaltyTierSilver, 10);
    const tierGold = parseInt(loyaltyTierGold, 10);

    if (loyaltyEnabled) {
      if (isNaN(earnRate) || earnRate <= 0) {
        Alert.alert(t('common.invalid'), 'Loyalty earn rate must be a positive number (cents per point)');
        return;
      }
      if (isNaN(redeemRate) || redeemRate <= 0) {
        Alert.alert(t('common.invalid'), 'Loyalty redeem rate must be a positive number (cents per point)');
        return;
      }
      if (expiryDays !== null && (isNaN(expiryDays) || expiryDays <= 0)) {
        Alert.alert(t('common.invalid'), 'Loyalty expiry days must be a positive number or empty');
        return;
      }
      if (isNaN(tierSilver) || tierSilver <= 0 || isNaN(tierGold) || tierGold <= 0) {
        Alert.alert(t('common.invalid'), 'Loyalty tier thresholds must be positive numbers');
        return;
      }
      if (tierGold <= tierSilver) {
        Alert.alert(t('common.invalid'), 'Gold tier threshold must be greater than Silver tier');
        return;
      }
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
        autoLockMinutes: lockMinutes,
      });

      // Save loyalty settings
      await loyaltyService.updateConfig({
        enabled: loyaltyEnabled,
        earnRate,
        redeemRate,
        expiryDays,
      });

      // Save store credit settings
      await storeCreditService.setEnabled(storeCreditEnabled);

      setDirty(false);
      Alert.alert(t('common.saved'), t('settings.posConfig.saved'));
    } catch {
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

        <Text style={styles.label}>Auto-lock after inactivity (minutes)</Text>
        <TextInput
          style={styles.input}
          value={autoLockMinutes}
          onChangeText={markDirty(setAutoLockMinutes)}
          placeholder={String(DEFAULT_AUTO_LOCK_MINUTES)}
          placeholderTextColor={lightColors.textSecondary}
          keyboardType="number-pad"
        />
        <Text style={styles.helpText}>Locks the register and requires sign-in after this many idle minutes. Set 0 to disable.</Text>
      </View>

      {/* Loyalty Program */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Loyalty Program</Text>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.label}>Enable Loyalty Program</Text>
            <Text style={styles.helpText}>Allow customers to earn and redeem loyalty points</Text>
          </View>
          <Switch
            value={loyaltyEnabled}
            onValueChange={v => {
              setLoyaltyEnabled(v);
              setDirty(true);
            }}
            trackColor={{ false: lightColors.border, true: lightColors.primary + '60' }}
            thumbColor={loyaltyEnabled ? lightColors.primary : lightColors.textSecondary}
          />
        </View>

        {loyaltyEnabled && (
          <>
            <Text style={styles.label}>Earn Rate (cents per point)</Text>
            <TextInput
              style={styles.input}
              value={loyaltyEarnRate}
              onChangeText={markDirty(setLoyaltyEarnRate)}
              placeholder="100"
              placeholderTextColor={lightColors.textSecondary}
              keyboardType="number-pad"
            />
            <Text style={styles.helpText}>Customer earns 1 point for every X cents spent (e.g., 100 = £1 per point)</Text>

            <Text style={styles.label}>Redeem Rate (cents per point)</Text>
            <TextInput
              style={styles.input}
              value={loyaltyRedeemRate}
              onChangeText={markDirty(setLoyaltyRedeemRate)}
              placeholder="1"
              placeholderTextColor={lightColors.textSecondary}
              keyboardType="number-pad"
            />
            <Text style={styles.helpText}>Each point is worth X cents when redeemed (e.g., 1 = 1p per point)</Text>

            <Text style={styles.label}>Expiry Days (optional)</Text>
            <TextInput
              style={styles.input}
              value={loyaltyExpiryDays}
              onChangeText={markDirty(setLoyaltyExpiryDays)}
              placeholder="Leave empty for no expiry"
              placeholderTextColor={lightColors.textSecondary}
              keyboardType="number-pad"
            />
            <Text style={styles.helpText}>Points expire after X days (leave empty for no expiry)</Text>

            <Text style={styles.label}>Silver Tier Threshold (points)</Text>
            <TextInput
              style={styles.input}
              value={loyaltyTierSilver}
              onChangeText={markDirty(setLoyaltyTierSilver)}
              placeholder="500"
              placeholderTextColor={lightColors.textSecondary}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Gold Tier Threshold (points)</Text>
            <TextInput
              style={styles.input}
              value={loyaltyTierGold}
              onChangeText={markDirty(setLoyaltyTierGold)}
              placeholder="2000"
              placeholderTextColor={lightColors.textSecondary}
              keyboardType="number-pad"
            />
            <Text style={styles.helpText}>Tiers are based on lifetime points earned</Text>
          </>
        )}
      </View>

      {/* Store Credit */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Store Credit</Text>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.label}>Enable Store Credit</Text>
            <Text style={styles.helpText}>Allow issuing and redeeming store credit</Text>
          </View>
          <Switch
            value={storeCreditEnabled}
            onValueChange={v => {
              setStoreCreditEnabled(v);
              setDirty(true);
            }}
            trackColor={{ false: lightColors.border, true: lightColors.primary + '60' }}
            thumbColor={storeCreditEnabled ? lightColors.primary : lightColors.textSecondary}
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
  helpText: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  saveButton: {
    backgroundColor: lightColors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  saveButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
  },
});

export default POSConfigSettingsTab;
