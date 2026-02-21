import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';
import { LocalOrder } from '../../services/basket/BasketServiceInterface';
import ReceiptTemplate from './ReceiptTemplate';

interface ReceiptModalProps {
  visible: boolean;
  order: LocalOrder | null;
  onPrint: () => void;
  onClose: () => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ visible, order, onPrint, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Order Receipt</Text>

          <ScrollView style={styles.receiptScroll} showsVerticalScrollIndicator={false}>
            {order && <ReceiptTemplate order={order} />}
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.printButton} onPress={onPrint}>
              <MaterialIcons name="print" size={18} color={lightColors.surface} />
              <Text style={styles.printText}>Print Receipt</Text>
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
    width: '90%',
    maxWidth: 450,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  receiptScroll: {
    maxHeight: 400,
    marginVertical: spacing.sm,
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
  printButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.success,
  },
  printText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.surface,
  },
});

export default ReceiptModal;
