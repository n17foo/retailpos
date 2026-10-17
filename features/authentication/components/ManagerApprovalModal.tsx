/**
 * ManagerApprovalModal
 *
 * In-context manager PIN challenge. Displayed when a cashier attempts
 * an action they are not permitted to perform.
 *
 * Subscribes to ManagerApprovalService.getPending() and renders
 * automatically when a pending approval exists.
 *
 * See: docs/specs/auth/permissions.md §2.2
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import PinDisplay from './PinDisplay';
import PinKeypad from './PinKeypad';
import { managerApprovalService } from '../services/permissions/ManagerApprovalService';

const MAX_PIN_LENGTH = 6;

export const ManagerApprovalModal: React.FC = () => {
  const [pending, setPending] = useState(managerApprovalService.getPending());
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Subscribe to service state changes
  useEffect(() => {
    const unsubscribe = managerApprovalService.subscribe(() => {
      setPending(managerApprovalService.getPending());
      setPin('');
      setError(null);
      setIsVerifying(false);
    });
    return unsubscribe;
  }, []);

  const submitPin = useCallback(async (pinValue: string) => {
    setIsVerifying(true);
    setError(null);
    const result = await managerApprovalService.submitManagerPin(pinValue);
    if (!result.success) {
      setPin('');
      setError(result.error ?? 'Authentication failed');
      setIsVerifying(false);
    }
    // On success the service clears pending and notifies listeners — no local state update needed
  }, []);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (key === 'biometric' || isVerifying) return;
      setPin(prev => {
        if (prev.length >= MAX_PIN_LENGTH) return prev;
        const next = prev + key;
        if (next.length === MAX_PIN_LENGTH) {
          submitPin(next);
        }
        return next;
      });
      setError(null);
    },
    [isVerifying, submitPin]
  );

  const handleDelete = useCallback(() => {
    if (isVerifying) return;
    setPin(prev => prev.slice(0, -1));
    setError(null);
  }, [isVerifying]);

  const handleCancel = useCallback(() => {
    managerApprovalService.cancel();
  }, []);

  if (!pending) return null;

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      {/* Overlay blocks all touches behind the modal */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Manager Approval Required</Text>
          </View>

          {/* Action description */}
          <View style={styles.body}>
            <Text style={styles.actionLabel}>Action:</Text>
            <Text style={styles.actionDescription}>{pending.actionDescription}</Text>
            <Text style={styles.instruction}>Please ask a manager to enter their PIN to authorise this action.</Text>

            {/* PIN display */}
            <View style={styles.pinDisplayWrapper}>
              <PinDisplay pinLength={MAX_PIN_LENGTH} filledCount={pin.length} />
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Verifying indicator */}
            {isVerifying ? (
              <View style={styles.verifyingRow}>
                <ActivityIndicator size="small" color={lightColors.primary} />
                <Text style={styles.verifyingText}>Verifying…</Text>
              </View>
            ) : null}

            {/* Keypad */}
            <View style={styles.keypadWrapper}>
              <PinKeypad onKeyPress={handleKeyPress} onDeletePress={handleDelete} disableBiometric />
            </View>
          </View>

          {/* Cancel */}
          <View style={styles.footer}>
            <Button title="Cancel" variant="outline" fullWidth onPress={handleCancel} disabled={isVerifying} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: lightColors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    ...elevation.high,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  body: {
    padding: spacing.md,
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  actionDescription: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  instruction: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  pinDisplayWrapper: {
    marginBottom: spacing.sm,
  },
  errorBox: {
    backgroundColor: lightColors.error + '15',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    width: '100%',
  },
  errorText: {
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  verifyingText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  keypadWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
});

export default ManagerApprovalModal;
