import React from 'react';
import { View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../utils/theme';
import { Button } from './Button';

interface ReceiptPreviewProps {
  visible: boolean;
  lines: string[];
  onPrint: () => void;
  onClose: () => void;
  title?: string;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ visible, lines, onPrint, onClose, title = 'Receipt Preview' }) => {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.receiptScroll} contentContainerStyle={styles.receiptContent}>
            <View style={styles.receiptPaper}>
              {lines.map((line, index) => (
                <Text key={index} style={styles.receiptLine}>
                  {line || ' '}
                </Text>
              ))}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Button title="Close" variant="outline" onPress={onClose} style={styles.actionButton} />
            <Button title="🖨  Print" variant="primary" onPress={onPrint} style={styles.actionButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    ...elevation.high,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lightColors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  receiptScroll: {
    flex: 1,
  },
  receiptContent: {
    padding: spacing.md,
  },
  receiptPaper: {
    backgroundColor: '#FFFFF0',
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  receiptLine: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 18,
    color: lightColors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});

export default ReceiptPreview;
