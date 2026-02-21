import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, StyleSheet } from 'react-native';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';

interface ShiftModalProps {
  visible: boolean;
  mode: 'open' | 'close';
  cashAmount: string;
  isProcessing: boolean;
  onCashAmountChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const ShiftModal: React.FC<ShiftModalProps> = ({ visible, mode, cashAmount, isProcessing, onCashAmountChange, onSubmit, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{mode === 'open' ? 'Open Shift' : 'Close Shift'}</Text>
          <Text style={styles.modalDescription}>
            {mode === 'open' ? 'Enter the opening cash amount in the drawer.' : 'Count and enter the closing cash amount in the drawer.'}
          </Text>

          <Text style={styles.inputLabel}>Cash Amount ($)</Text>
          <TextInput
            style={styles.modalInput}
            value={cashAmount}
            onChangeText={onCashAmountChange}
            placeholder="0.00"
            keyboardType="decimal-pad"
            autoFocus
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSubmitButton, isProcessing && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={isProcessing}
            >
              <Text style={styles.modalSubmitText}>{isProcessing ? 'Processing...' : mode === 'open' ? 'Open Shift' : 'Close Shift'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: lightColors.background,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.divider,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.primary,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.surface,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ShiftModal;
