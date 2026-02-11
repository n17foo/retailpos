import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { lightColors, spacing, borderRadius, typography } from '../utils/theme';

export type BadgeStatus = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'neutral';

interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const STATUS_COLORS: Record<BadgeStatus, { bg: string; text: string }> = {
  success: { bg: '#E8F5E9', text: '#2E7D32' },
  warning: { bg: '#FFF8E1', text: '#F57F17' },
  error: { bg: '#FFEBEE', text: '#C62828' },
  info: { bg: '#E3F2FD', text: '#1565C0' },
  pending: { bg: '#FFF3E0', text: '#E65100' },
  neutral: { bg: '#F5F5F5', text: '#616161' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm', style }) => {
  const colors = STATUS_COLORS[status];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          paddingVertical: isSmall ? 2 : spacing.xs,
          paddingHorizontal: isSmall ? spacing.xs : spacing.sm,
        },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.text }]} />
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: isSmall ? typography.fontSize.xs : typography.fontSize.sm,
          },
        ]}
      >
        {label}
      </Text>
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontWeight: '600',
  },
});

export default StatusBadge;
