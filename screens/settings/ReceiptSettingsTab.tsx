import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useReceiptConfig, ReceiptConfig } from '../../hooks/useReceiptConfig';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';

type PrinterModelType = 'snbc_orient' | 'epson' | 'star' | 'citizen' | 'generic';

const PRINTER_MODELS: { value: PrinterModelType; label: string }[] = [
  { value: 'snbc_orient', label: 'SNBC Orient' },
  { value: 'epson', label: 'Epson' },
  { value: 'star', label: 'Star' },
  { value: 'citizen', label: 'Citizen' },
  { value: 'generic', label: 'Generic/Other' },
];

const PAPER_WIDTHS: { value: 58 | 80; label: string }[] = [
  { value: 58, label: '58mm' },
  { value: 80, label: '80mm' },
];

const ReceiptSettingsTab: React.FC = () => {
  const { config, isLoading, error, updateHeader, updateFooter, updateOptions, setPrinterModel, reload } = useReceiptConfig();

  const [localHeader, setLocalHeader] = useState(config.header);
  const [localFooter, setLocalFooter] = useState(config.footer);
  const [localOptions, setLocalOptions] = useState(config.options);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalHeader(config.header);
    setLocalFooter(config.footer);
    setLocalOptions(config.options);
  }, [config]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateHeader(localHeader);
      await updateFooter(localFooter);
      await updateOptions(localOptions);
      setHasChanges(false);
      Alert.alert('Success', 'Receipt settings saved successfully');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [localHeader, localFooter, localOptions, updateHeader, updateFooter, updateOptions]);

  const handlePrinterModelChange = useCallback(
    async (model: PrinterModelType) => {
      try {
        await setPrinterModel(model);
        Alert.alert('Success', `Printer model set to ${PRINTER_MODELS.find(m => m.value === model)?.label}`);
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to set printer model');
      }
    },
    [setPrinterModel]
  );

  const updateLocalHeader = (updates: Partial<typeof localHeader>) => {
    setLocalHeader(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateLocalFooter = (updates: Partial<typeof localFooter>) => {
    setLocalFooter(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateLocalOptions = (updates: Partial<typeof localOptions>) => {
    setLocalOptions(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={lightColors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Printer Model Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Printer Model</Text>
        <Text style={styles.sectionDescription}>Select your thermal printer model for optimal compatibility</Text>
        <View style={styles.modelGrid}>
          {PRINTER_MODELS.map(model => (
            <TouchableOpacity
              key={model.value}
              style={[styles.modelOption, config.printerModel.type === model.value && styles.modelOptionSelected]}
              onPress={() => handlePrinterModelChange(model.value)}
            >
              <Text style={[styles.modelText, config.printerModel.type === model.value && styles.modelTextSelected]}>{model.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Paper Width */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paper Width</Text>
        <View style={styles.radioGroup}>
          {PAPER_WIDTHS.map(width => (
            <TouchableOpacity key={width.value} style={styles.radioOption} onPress={() => updateLocalOptions({ paperWidth: width.value })}>
              <View style={[styles.radioButton, localOptions.paperWidth === width.value && styles.radioButtonSelected]}>
                {localOptions.paperWidth === width.value && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={styles.radioText}>{width.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Header Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Receipt Header</Text>
        <Text style={styles.sectionDescription}>This information appears at the top of every receipt</Text>

        <Text style={styles.inputLabel}>Business Name *</Text>
        <TextInput
          style={styles.input}
          value={localHeader.businessName}
          onChangeText={text => updateLocalHeader({ businessName: text })}
          placeholder="Your Business Name"
        />

        <Text style={styles.inputLabel}>Address Line 1</Text>
        <TextInput
          style={styles.input}
          value={localHeader.addressLine1}
          onChangeText={text => updateLocalHeader({ addressLine1: text })}
          placeholder="123 Main Street"
        />

        <Text style={styles.inputLabel}>Address Line 2</Text>
        <TextInput
          style={styles.input}
          value={localHeader.addressLine2}
          onChangeText={text => updateLocalHeader({ addressLine2: text })}
          placeholder="City, State ZIP"
        />

        <Text style={styles.inputLabel}>Phone</Text>
        <TextInput
          style={styles.input}
          value={localHeader.phone}
          onChangeText={text => updateLocalHeader({ phone: text })}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
        />

        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={localHeader.email}
          onChangeText={text => updateLocalHeader({ email: text })}
          placeholder="info@business.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.inputLabel}>Website</Text>
        <TextInput
          style={styles.input}
          value={localHeader.website}
          onChangeText={text => updateLocalHeader({ website: text })}
          placeholder="www.business.com"
          autoCapitalize="none"
        />

        <Text style={styles.inputLabel}>Tax ID / VAT Number</Text>
        <TextInput
          style={styles.input}
          value={localHeader.taxId}
          onChangeText={text => updateLocalHeader({ taxId: text })}
          placeholder="Tax ID"
        />
      </View>

      {/* Footer Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Receipt Footer</Text>
        <Text style={styles.sectionDescription}>Custom messages that appear at the bottom of receipts</Text>

        <Text style={styles.inputLabel}>Footer Line 1</Text>
        <TextInput
          style={styles.input}
          value={localFooter.line1}
          onChangeText={text => updateLocalFooter({ line1: text })}
          placeholder="Thank you for your purchase!"
        />

        <Text style={styles.inputLabel}>Footer Line 2</Text>
        <TextInput
          style={styles.input}
          value={localFooter.line2}
          onChangeText={text => updateLocalFooter({ line2: text })}
          placeholder="Please come again"
        />

        <Text style={styles.inputLabel}>Footer Line 3</Text>
        <TextInput
          style={styles.input}
          value={localFooter.line3}
          onChangeText={text => updateLocalFooter({ line3: text })}
          placeholder="www.yourwebsite.com"
        />
      </View>

      {/* Print Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Print Options</Text>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Print Barcode</Text>
          <TouchableOpacity
            style={[styles.toggle, localOptions.printBarcode && styles.toggleActive]}
            onPress={() => updateLocalOptions({ printBarcode: !localOptions.printBarcode })}
          >
            <Text style={styles.toggleText}>{localOptions.printBarcode ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Print QR Code</Text>
          <TouchableOpacity
            style={[styles.toggle, localOptions.printQRCode && styles.toggleActive]}
            onPress={() => updateLocalOptions({ printQRCode: !localOptions.printQRCode })}
          >
            <Text style={styles.toggleText}>{localOptions.printQRCode ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Auto Cut Paper</Text>
          <TouchableOpacity
            style={[styles.toggle, localOptions.cutPaper && styles.toggleActive]}
            onPress={() => updateLocalOptions({ cutPaper: !localOptions.cutPaper })}
          >
            <Text style={styles.toggleText}>{localOptions.cutPaper ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Open Cash Drawer</Text>
          <TouchableOpacity
            style={[styles.toggle, localOptions.openCashDrawer && styles.toggleActive]}
            onPress={() => updateLocalOptions({ openCashDrawer: !localOptions.openCashDrawer })}
          >
            <Text style={styles.toggleText}>{localOptions.openCashDrawer ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.inputLabel}>Number of Copies</Text>
        <View style={styles.copiesContainer}>
          <TouchableOpacity
            style={styles.copiesButton}
            onPress={() => updateLocalOptions({ copies: Math.max(1, localOptions.copies - 1) })}
          >
            <Text style={styles.copiesButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.copiesValue}>{localOptions.copies}</Text>
          <TouchableOpacity
            style={styles.copiesButton}
            onPress={() => updateLocalOptions({ copies: Math.min(5, localOptions.copies + 1) })}
          >
            <Text style={styles.copiesButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!hasChanges || isSaving}
      >
        <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
      </TouchableOpacity>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.spacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  scrollContent: {
    padding: spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: lightColors.textSecondary,
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
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.md,
  },
  modelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modelOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.background,
  },
  modelOptionSelected: {
    backgroundColor: lightColors.primary,
    borderColor: lightColors.primary,
  },
  modelText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
  modelTextSelected: {
    color: lightColors.surface,
    fontWeight: '600',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: lightColors.primary,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    backgroundColor: lightColors.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: lightColors.surface,
  },
  radioText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: lightColors.background,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  optionLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  toggle: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    backgroundColor: lightColors.divider,
    minWidth: 60,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: lightColors.primary,
  },
  toggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.surface,
  },
  copiesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  copiesButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copiesButtonText: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.surface,
  },
  copiesValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginHorizontal: spacing.lg,
    minWidth: 30,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: lightColors.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    backgroundColor: lightColors.divider,
  },
  saveButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.surface,
  },
  errorContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: `${lightColors.error}20`,
    borderRadius: borderRadius.md,
  },
  errorText: {
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
  },
  spacer: {
    height: spacing.xl,
  },
});

export default ReceiptSettingsTab;
