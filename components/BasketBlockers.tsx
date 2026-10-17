/**
 * Basket Blockers
 *
 * Displays validation issues that prevent checkout.
 * Implements Sales UX spec §2.3 (Basket Validation & Blockers).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';

export type BlockerType = 'error' | 'warning' | 'info';

/** Stable identifiers so UI can attach behaviour without matching on message text */
export type BlockerCode = 'customer-required' | 'variant-required' | 'unsynced-orders';

export interface BasketBlocker {
  type: BlockerType;
  code?: BlockerCode;
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export interface BasketBlockersProps {
  blockers: BasketBlocker[];
}

export const BasketBlockers: React.FC<BasketBlockersProps> = ({ blockers }) => {
  // Shake animation for blockers
  const shakeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (blockers.length > 0) {
      // Shake animation when blockers appear
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [blockers.length, shakeAnim]);

  if (blockers.length === 0) {
    return null;
  }

  const getBlockerStyle = (type: BlockerType) => {
    switch (type) {
      case 'error':
        return {
          bg: lightColors.error + '20',
          border: lightColors.error,
          icon: 'error' as const,
          iconColor: lightColors.error,
          textColor: lightColors.error,
        };
      case 'warning':
        return {
          bg: lightColors.warning + '20',
          border: lightColors.warning,
          icon: 'warning' as const,
          iconColor: lightColors.warning,
          textColor: lightColors.warning,
        };
      case 'info':
        return {
          bg: lightColors.info + '20',
          border: lightColors.info,
          icon: 'info' as const,
          iconColor: lightColors.info,
          textColor: lightColors.info,
        };
    }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}>
      {/* ENHANCED: Prominent header banner */}
      <View style={styles.headerBanner}>
        <MaterialIcons name="warning" size={20} color={lightColors.textOnPrimary} />
        <Text style={styles.headerText}>
          {blockers.length} {blockers.length === 1 ? 'ISSUE' : 'ISSUES'} TO RESOLVE
        </Text>
      </View>

      {blockers.map((blocker, index) => {
        const style = getBlockerStyle(blocker.type);
        return (
          <View
            key={index}
            style={[
              styles.blocker,
              {
                backgroundColor: style.bg,
                borderColor: style.border,
              },
            ]}
          >
            <View style={styles.blockerContent}>
              <MaterialIcons name={style.icon} size={22} color={style.iconColor} />
              <Text style={[styles.blockerMessage, { color: style.textColor }]}>{blocker.message}</Text>
            </View>
            {blocker.action && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: style.iconColor }]}
                onPress={blocker.action.onPress}
                accessibilityLabel={blocker.action.label}
                accessibilityRole="button"
              >
                <Text style={styles.actionButtonText}>{blocker.action.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...elevation.medium,
  },
  // ENHANCED: Prominent header banner
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: lightColors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerText: {
    fontSize: typography.fontSize.md,
    fontWeight: '800',
    color: lightColors.textOnPrimary,
    letterSpacing: 0.5,
  },
  blocker: {
    borderWidth: 2,
    borderRadius: 0, // Square for stacked look
    padding: spacing.md,
    gap: spacing.sm,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  blockerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  blockerMessage: {
    flex: 1,
    fontSize: typography.fontSize.md,
    lineHeight: 22,
    fontWeight: '600',
  },
  actionButton: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: 30, // Align with message text (icon width + gap)
    ...elevation.low,
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: lightColors.textOnPrimary,
  },
});
