import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography } from '../../../shared/utils/theme';
import type { ScanNotice } from '../hooks/useSaleScanner';

/**
 * Inline scan-result banner (spec §4.5) — replaces the old blocking Alert.
 * Sits above the catalogue area and auto-dismisses (the hook clears it).
 */
const ScanNoticeBarInner: React.FC<{ notice: ScanNotice }> = ({ notice }) => {
  const config =
    notice.kind === 'added'
      ? { icon: 'check-circle' as const, color: lightColors.success, label: `${notice.name ?? 'Item'} added` }
      : notice.kind === 'out_of_stock'
        ? { icon: 'remove-shopping-cart' as const, color: lightColors.warning, label: `${notice.name ?? 'Item'} is out of stock` }
        : { icon: 'error-outline' as const, color: lightColors.error, label: `No product for “${notice.code}”` };

  return (
    <View
      style={[styles.banner, { borderColor: config.color }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Scan result: ${config.label}`}
      accessibilityRole="alert"
    >
      <MaterialIcons name={config.icon} size={18} color={config.color} />
      <Text style={[styles.text, { color: config.color }]} numberOfLines={1}>
        {config.label}
      </Text>
    </View>
  );
};

export const ScanNoticeBar = memo(ScanNoticeBarInner);

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    backgroundColor: lightColors.surface,
  },
  text: { fontSize: typography.fontSize.sm, fontWeight: '600', flex: 1 },
});
