/**
 * Recovery Modal
 *
 * Replaces generic Alert dialogs with guided recovery flows.
 * Implements Sales UX spec §2.5 (Recovery Modals).
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';

export type RecoveryModalType = 'error' | 'warning' | 'info' | 'success';
export type RecoveryActionType = 'primary' | 'secondary' | 'tertiary';

export interface RecoveryAction {
  label: string;
  type: RecoveryActionType;
  destructive?: boolean;
  onPress: () => void;
}

export interface RecoveryModalProps {
  visible: boolean;
  type: RecoveryModalType;
  title: string;
  message: string;
  details?: string;
  actions: RecoveryAction[];
  onDismiss?: () => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({ visible, type, title, message, details, actions, onDismiss }) => {
  const getTypeStyle = () => {
    switch (type) {
      case 'error':
        return {
          icon: 'error' as const,
          iconColor: lightColors.error,
          iconBg: lightColors.error + '15',
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          iconColor: lightColors.warning,
          iconBg: lightColors.warning + '15',
        };
      case 'info':
        return {
          icon: 'info' as const,
          iconColor: lightColors.info,
          iconBg: lightColors.info + '15',
        };
      case 'success':
        return {
          icon: 'check-circle' as const,
          iconColor: lightColors.success,
          iconBg: lightColors.success + '15',
        };
    }
  };

  const typeStyle = getTypeStyle();

  const primaryActions = actions.filter(a => a.type === 'primary');
  const secondaryActions = actions.filter(a => a.type === 'secondary');
  const tertiaryActions = actions.filter(a => a.type === 'tertiary');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Close button */}
          {onDismiss && (
            <TouchableOpacity style={styles.closeButton} onPress={onDismiss} accessibilityLabel="Close" accessibilityRole="button">
              <MaterialIcons name="close" size={20} color={lightColors.textSecondary} />
            </TouchableOpacity>
          )}

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: typeStyle.iconBg }]}>
              <MaterialIcons name={typeStyle.icon} size={40} color={typeStyle.iconColor} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Details */}
            {details && <Text style={styles.details}>{details}</Text>}

            {/* Actions */}
            <View style={styles.actionsContainer}>
              {/* Primary actions */}
              {primaryActions.map((action, index) => (
                <TouchableOpacity
                  key={`primary-${index}`}
                  style={[styles.actionButton, styles.primaryButton, action.destructive && styles.destructiveButton]}
                  onPress={action.onPress}
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                >
                  <Text style={[styles.actionButtonText, styles.primaryButtonText, action.destructive && styles.destructiveButtonText]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Secondary actions */}
              {secondaryActions.map((action, index) => (
                <TouchableOpacity
                  key={`secondary-${index}`}
                  style={[styles.actionButton, styles.secondaryButton]}
                  onPress={action.onPress}
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                >
                  <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>{action.label}</Text>
                </TouchableOpacity>
              ))}

              {/* Tertiary actions */}
              {tertiaryActions.map((action, index) => (
                <TouchableOpacity
                  key={`tertiary-${index}`}
                  style={styles.tertiaryButton}
                  onPress={action.onPress}
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                >
                  <Text style={[styles.tertiaryButtonText, action.destructive && { color: lightColors.error }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const overlayBackgroundColor = lightColors.overlay;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: overlayBackgroundColor,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    maxWidth: 480,
    width: '100%',
    maxHeight: '80%',
    ...elevation.high,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.round,
  },
  content: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  details: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  actionsContainer: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: lightColors.primary,
  },
  destructiveButton: {
    backgroundColor: lightColors.error,
  },
  secondaryButton: {
    backgroundColor: lightColors.background,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  tertiaryButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
  },
  primaryButtonText: {
    color: lightColors.textOnPrimary,
  },
  destructiveButtonText: {
    color: lightColors.textOnPrimary,
  },
  secondaryButtonText: {
    color: lightColors.textPrimary,
  },
  tertiaryButtonText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
});
