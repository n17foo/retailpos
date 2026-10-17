/**
 * Interruption Banner
 *
 * Detects and offers resume for interrupted operations.
 * Implements Sales UX spec §2.6 (Interruption Detection & Resume).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../../shared/utils/theme';

export type InterruptionType = 'draft-sale' | 'interrupted-checkout' | 'interrupted-payment' | 'unsynced' | 'none';

export interface InterruptionAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

export interface InterruptionBannerProps {
  type: InterruptionType;
  message: string;
  actions: InterruptionAction[];
  onDismiss?: () => void;
}

export const InterruptionBanner: React.FC<InterruptionBannerProps> = ({ type, message, actions, onDismiss }) => {
  if (type === 'none') {
    return null;
  }

  const getTypeStyle = () => {
    switch (type) {
      case 'draft-sale':
        return {
          icon: 'shopping-cart' as const,
          iconColor: lightColors.info,
          bg: lightColors.info + '15',
          border: lightColors.info + '40',
        };
      case 'interrupted-checkout':
        return {
          icon: 'payment' as const,
          iconColor: lightColors.warning,
          bg: lightColors.warning + '15',
          border: lightColors.warning + '40',
        };
      case 'interrupted-payment':
        return {
          icon: 'error' as const,
          iconColor: lightColors.error,
          bg: lightColors.error + '15',
          border: lightColors.error + '40',
        };
      case 'unsynced':
        return {
          icon: 'sync-problem' as const,
          iconColor: lightColors.warning,
          bg: lightColors.warning + '15',
          border: lightColors.warning + '40',
        };
      default:
        return {
          icon: 'info' as const,
          iconColor: lightColors.info,
          bg: lightColors.info + '15',
          border: lightColors.info + '40',
        };
    }
  };

  const typeStyle = getTypeStyle();

  return (
    <View style={[styles.container, { backgroundColor: typeStyle.bg, borderColor: typeStyle.border }]}>
      <View style={styles.content}>
        <MaterialIcons name={typeStyle.icon} size={20} color={typeStyle.iconColor} />
        <Text style={[styles.message, { color: typeStyle.iconColor }]}>{message}</Text>
      </View>

      <View style={styles.actions}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.actionButton, action.variant === 'primary' && styles.primaryActionButton, { borderColor: typeStyle.iconColor }]}
            onPress={action.onPress}
            accessibilityLabel={action.label}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.actionButtonText,
                action.variant === 'primary' && styles.primaryActionButtonText,
                { color: typeStyle.iconColor },
              ]}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}

        {onDismiss && (
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} accessibilityLabel="Dismiss" accessibilityRole="button">
            <MaterialIcons name="close" size={18} color={typeStyle.iconColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    margin: spacing.md,
    gap: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: 28, // Align with message text (icon width + gap)
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  primaryActionButton: {
    // Primary actions have filled background
  },
  actionButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
  },
  primaryActionButtonText: {
    // Primary action text styling
  },
  dismissButton: {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
