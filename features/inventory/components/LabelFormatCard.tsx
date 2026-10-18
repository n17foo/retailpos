import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography } from '../../../shared/utils/theme';
import { Card } from '../../../shared/components/Card';
import { LabelFormat } from '../services/BarcodeLabelService';

const FORMAT_OPTIONS: Array<{ key: 'includeName' | 'includeSku' | 'includePrice'; label: string }> = [
  { key: 'includeName', label: 'Product Name' },
  { key: 'includeSku', label: 'SKU' },
  { key: 'includePrice', label: 'Price' },
];

interface LabelFormatCardProps {
  format: LabelFormat;
  onFormatChange: (updater: (prev: LabelFormat) => LabelFormat) => void;
}

/** Label format card — font size plus include name/SKU/price toggles. */
export const LabelFormatCard: React.FC<LabelFormatCardProps> = ({ format, onFormatChange }) => (
  <Card style={styles.formatCard}>
    <Text style={styles.formatTitle}>Label Format</Text>
    <View style={styles.formatOptions}>
      <View style={styles.formatRow}>
        <Text style={styles.formatLabel}>Font Size:</Text>
        <View style={styles.fontSizeButtons}>
          {(['small', 'medium', 'large'] as const).map(size => (
            <TouchableOpacity
              key={size}
              style={[styles.fontSizeButton, format.fontSize === size && styles.fontSizeButtonActive]}
              onPress={() => onFormatChange(prev => ({ ...prev, fontSize: size }))}
            >
              <Text style={[styles.fontSizeButtonText, format.fontSize === size && styles.fontSizeButtonTextActive]}>{size}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.formatCheckboxes}>
        {FORMAT_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.key}
            style={styles.formatCheckbox}
            onPress={() => onFormatChange(prev => ({ ...prev, [option.key]: !prev[option.key] }))}
          >
            <MaterialIcons name={format[option.key] ? 'check-box' : 'check-box-outline-blank'} size={20} color={lightColors.primary} />
            <Text style={styles.formatCheckboxText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </Card>
);

const styles = StyleSheet.create({
  formatCard: {
    margin: spacing.md,
    marginTop: 0,
  },
  formatTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.md,
  },
  formatOptions: {
    gap: spacing.md,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  fontSizeButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  fontSizeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.inputBackground,
  },
  fontSizeButtonActive: {
    borderColor: lightColors.primary,
    backgroundColor: lightColors.primary,
  },
  fontSizeButtonText: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    textTransform: 'capitalize',
  },
  fontSizeButtonTextActive: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
  },
  formatCheckboxes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  formatCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  formatCheckboxText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
});
