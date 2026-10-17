import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { lightColors, semanticColors, spacing, borderRadius, typography } from '../utils/theme';

export type BadgeStatus = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'neutral';

interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const STATUS_COLORS: Record<BadgeStatus, { bg: string; text: string }> = {
  success: { bg: lightColors.successBackground, text: lightColors.successText },
  warning: { bg: lightColors.warningBackground, text: lightColors.warningText },
  error: { bg: lightColors.errorBackground, text: lightColors.error },
  info: { bg: semanticColors.infoBackground, text: semanticColors.infoText },
  pending: { bg: lightColors.secondaryLight, text: lightColors.secondaryDark },
  neutral: { bg: lightColors.background, text: lightColors.textSecondary },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm', style }) => {
  const colors = STATUS_COLORS[status];
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, isSmall ? styles.badgeSmall : styles.badgeRegular, { backgroundColor: colors.bg }, style]}>
      <View style={[styles.dot, { backgroundColor: colors.text }]} />
      <Text style={[styles.text, isSmall ? styles.textSmall : styles.textRegular, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.round,
    gap: 4,
  },
  badgeSmall: {
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  badgeRegular: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontWeight: '600',
  },
  textSmall: {
    fontSize: typography.fontSize.xs,
  },
  textRegular: {
    fontSize: typography.fontSize.sm,
  },
});

export default StatusBadge;
