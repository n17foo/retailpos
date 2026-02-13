import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
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

export interface POSSetupValues {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  taxRate: string;
  currencySymbol: string;
  maxSyncRetries: string;
  drawerOpenOnCash: boolean;
}

interface POSSetupStepProps {
  onBack: () => void;
  onComplete: (values: POSSetupValues) => void;
}

const POSSetupStep: React.FC<POSSetupStepProps> = ({ onBack, onComplete }) => {
  const [values, setValues] = useState<POSSetupValues>({
    storeName: '',
    storeAddress: '',
    storePhone: '',
    taxRate: '',
    currencySymbol: '£',
    maxSyncRetries: '3',
    drawerOpenOnCash: true,
  });

  const updateField = <K extends keyof POSSetupValues>(field: K, value: POSSetupValues[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    if (!values.storeName.trim()) {
      Alert.alert('Required', 'Please enter your store name.');
      return false;
    }
    if (!values.taxRate.trim()) {
      Alert.alert('Required', 'Please enter your tax rate.');
      return false;
    }
    const rate = parseFloat(values.taxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert('Invalid', 'Tax rate must be a number between 0 and 100.');
      return false;
    }
    if (!values.currencySymbol) {
      Alert.alert('Required', 'Please select a currency.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validate()) {
      onComplete(values);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Store Setup</Text>
      <Text style={styles.subtitle}>
        Configure your store details and tax settings. These values are used for receipts, tax calculations, and order sync.
      </Text>

      {/* Store Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Store Information</Text>

        <Text style={styles.label}>
          Store Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={values.storeName}
          onChangeText={v => updateField('storeName', v)}
          placeholder="e.g. My Retail Shop"
          placeholderTextColor={lightColors.textSecondary}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={values.storeAddress}
          onChangeText={v => updateField('storeAddress', v)}
          placeholder="123 High Street, London"
          placeholderTextColor={lightColors.textSecondary}
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={values.storePhone}
          onChangeText={v => updateField('storePhone', v)}
          placeholder="+44 20 1234 5678"
          placeholderTextColor={lightColors.textSecondary}
          keyboardType="phone-pad"
        />
      </View>

      {/* Tax & Currency */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tax &amp; Currency</Text>

        <Text style={styles.label}>
          Tax Rate (%) <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={values.taxRate}
          onChangeText={v => updateField('taxRate', v)}
          placeholder="e.g. 8 for 8%"
          placeholderTextColor={lightColors.textSecondary}
          keyboardType="decimal-pad"
        />
        <Text style={styles.hint}>Enter as a percentage (e.g. 20 for 20% VAT)</Text>

        <Text style={styles.label}>
          Currency <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.currencyGrid}>
          {CURRENCY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.symbol}
              style={[styles.currencyOption, values.currencySymbol === opt.symbol && styles.currencyOptionActive]}
              onPress={() => updateField('currencySymbol', opt.symbol)}
            >
              <Text style={[styles.currencyText, values.currencySymbol === opt.symbol && styles.currencyTextActive]}>{opt.label}</Text>
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
          value={values.maxSyncRetries}
          onChangeText={v => updateField('maxSyncRetries', v)}
          placeholder="3"
          placeholderTextColor={lightColors.textSecondary}
          keyboardType="number-pad"
        />
        <Text style={styles.hint}>How many times to retry syncing a failed order before giving up</Text>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.label}>Open drawer on cash payment</Text>
            <Text style={styles.hint}>Automatically open the cash drawer when a cash payment completes</Text>
          </View>
          <Switch
            value={values.drawerOpenOnCash}
            onValueChange={v => updateField('drawerOpenOnCash', v)}
            trackColor={{ false: lightColors.border, true: lightColors.primary + '60' }}
            thumbColor={values.drawerOpenOnCash ? lightColors.primary : lightColors.textSecondary}
          />
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  title: {
    fontSize: typography.fontSize.xl + 4,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  section: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
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
  required: {
    color: lightColors.error,
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.xs,
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
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  backButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textSecondary,
  },
  nextButton: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.primary,
  },
  nextButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
});

export default POSSetupStep;
