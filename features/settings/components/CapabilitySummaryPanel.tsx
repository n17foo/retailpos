import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { lightColors, spacing, borderRadius, typography, semanticColors } from '../../../shared/utils/theme';
import {
  getPlatformCapabilities,
  PlatformCapabilities,
  CapabilityLevel,
  BasketMode,
  getUnavailableReason,
} from '../../../shared/utils/platformCapabilities';
import { getPlatformDisplayName } from '../../../shared/utils/platforms';

/** Feature rows shown in the capability summary panel */
const CAPABILITY_FEATURES: Array<{ key: Exclude<keyof PlatformCapabilities, 'basketMode'>; label: string }> = [
  { key: 'catalog', label: 'Catalog & variants' },
  { key: 'customers', label: 'Customer management' },
  { key: 'inventory', label: 'Inventory sync' },
  { key: 'orderSync', label: 'Order sync' },
  { key: 'discounts', label: 'Discounts & coupons' },
  { key: 'giftCards', label: 'Gift cards' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'loyalty', label: 'Loyalty points sync' },
  { key: 'storeCredit', label: 'Store credit sync' },
];

const BASKET_MODE_LABEL: Record<BasketMode, { label: string; description: string; color: string; bg: string }> = {
  native_draft: {
    label: 'Native draft',
    description: 'Platform creates a draft order with server-calculated tax',
    color: lightColors.successText,
    bg: lightColors.successBackground,
  },
  remote_cart: {
    label: 'Remote cart',
    description: 'POS basket is local; platform cart/quote created post-payment',
    color: lightColors.secondaryDark,
    bg: lightColors.secondaryLight,
  },
  local_only: {
    label: 'Local only',
    description: 'Fully local basket; order imported to platform after payment',
    color: semanticColors.infoText,
    bg: semanticColors.infoBackground,
  },
};

const CAPABILITY_BADGE: Record<CapabilityLevel, { label: string; color: string; bg: string }> = {
  supported: { label: 'Supported', color: lightColors.successText, bg: lightColors.successBackground },
  custom: { label: 'Custom adapter', color: lightColors.secondaryDark, bg: lightColors.secondaryLight },
  not_recommended: { label: 'Not supported', color: lightColors.error, bg: lightColors.errorBackground },
};

interface CapabilitySummaryPanelProps {
  platform: string;
}

/**
 * Platform Capability Summary panel.
 * Reads from the centralized capability matrix — no hardcoded values.
 * Satisfies settings-tabs.md §5.3.a, §5.3.b, §5.11.
 */
export const CapabilitySummaryPanel: React.FC<CapabilitySummaryPanelProps> = ({ platform }) => {
  const capabilities = useMemo(() => getPlatformCapabilities(platform), [platform]);
  const platformName = getPlatformDisplayName(platform);
  const basketModeInfo = BASKET_MODE_LABEL[capabilities.basketMode];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Platform capability summary</Text>
      <Text style={styles.subtitle}>{platformName}</Text>

      {/* Basket mode — shown first as it affects checkout behaviour */}
      <View style={styles.row}>
        <Text style={styles.featureLabel}>Basket / checkout mode</Text>
        <View style={[styles.badge, { backgroundColor: basketModeInfo.bg }]}>
          <Text style={[styles.badgeText, { color: basketModeInfo.color }]}>{basketModeInfo.label}</Text>
        </View>
        <Text style={styles.reason} numberOfLines={2}>
          {basketModeInfo.description}
        </Text>
      </View>

      {CAPABILITY_FEATURES.map(({ key, label }) => {
        const level = capabilities[key];
        const badge = CAPABILITY_BADGE[level];
        const reason = level !== 'supported' ? getUnavailableReason(capabilities, key, platformName) : '';
        return (
          <View key={key} style={styles.row}>
            <Text style={styles.featureLabel}>{label}</Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
            {reason ? (
              <Text style={styles.reason} numberOfLines={2}>
                {reason}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold as '600',
    color: lightColors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    flexWrap: 'wrap' as const,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.divider,
  },
  featureLabel: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: lightColors.textPrimary,
    paddingRight: spacing.xs,
    paddingTop: 2,
  },
  badge: {
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    alignSelf: 'flex-start' as const,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  reason: {
    width: '100%',
    fontSize: 10,
    color: lightColors.textSecondary,
    marginTop: 2,
    fontStyle: 'italic' as const,
  },
});
