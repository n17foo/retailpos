import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../utils/theme';
import { formatMoney } from '../utils/money';
import { Button } from './Button';
import { useCurrency } from '../hooks/useCurrency';

export type PaymentMethod = 'cash' | 'card' | 'terminal';

interface CheckoutModalProps {
  visible: boolean;
  orderId: string;
  orderTotal: number;
  orderSubtotal: number;
  orderTax: number;
  itemCount: number;
  onSelectPayment: (method: PaymentMethod) => void;
  onCancel: () => void;
  onPrintReceipt?: () => void;
  isProcessing?: boolean;
  terminalConnected?: boolean;
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string; description: string }[] = [
  { id: 'cash', label: 'Cash', icon: '💵', description: 'Accept cash payment' },
  { id: 'card', label: 'Card', icon: '💳', description: 'Manual card entry' },
  { id: 'terminal', label: 'Terminal', icon: '📱', description: 'NFC / Tap to pay' },
];

export const CheckoutModal: React.FC<CheckoutModalProps> = props => {
  const currency = useCurrency();
  const {
    visible,
    orderId,
    orderTotal,
    orderSubtotal,
    orderTax,
    itemCount,
    onSelectPayment,
    onCancel,
    onPrintReceipt,
    isProcessing = false,
    terminalConnected = false,
  } = props;
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');

  const handleConfirm = () => {
    onSelectPayment(selectedMethod);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Complete Order</Text>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.closeButton}
              disabled={isProcessing}
              accessibilityLabel="Cancel checkout"
              accessibilityRole="button"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Order Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.orderRef}>Order #{orderId.slice(-8)}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Items</Text>
                <Text style={styles.summaryValue}>{itemCount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatMoney(orderSubtotal, currency.code)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>{formatMoney(orderTax, currency.code)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatMoney(orderTotal, currency.code)}</Text>
              </View>
            </View>

            {/* Payment Method Selection */}
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentMethods}>
              {PAYMENT_METHODS.map(method => {
                const isSelected = selectedMethod === method.id;
                const isDisabled = method.id === 'terminal' && !terminalConnected;

                return (
                  <TouchableOpacity
                    key={method.id}
                    style={[styles.paymentOption, isSelected && styles.paymentOptionSelected, isDisabled && styles.paymentOptionDisabled]}
                    onPress={() => !isDisabled && setSelectedMethod(method.id)}
                    disabled={isDisabled}
                    activeOpacity={0.7}
                    accessibilityLabel={`Pay with ${method.label}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                    accessibilityHint={isDisabled ? 'Terminal not connected' : method.description}
                  >
                    <Text style={styles.paymentIcon}>{method.icon}</Text>
                    <View style={styles.paymentInfo}>
                      <Text style={[styles.paymentLabel, isSelected && styles.paymentLabelSelected]}>{method.label}</Text>
                      <Text style={styles.paymentDescription}>{isDisabled ? 'Terminal not connected' : method.description}</Text>
                    </View>
                    {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            {onPrintReceipt && (
              <Button title="Print Receipt" variant="outline" onPress={onPrintReceipt} disabled={isProcessing} style={styles.printButton} />
            )}
            <Button
              title={isProcessing ? 'Processing...' : `Pay ${formatMoney(orderTotal, currency.code)}`}
              variant="success"
              size="lg"
              fullWidth
              onPress={handleConfirm}
              loading={isProcessing}
              disabled={isProcessing}
            />
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
    maxWidth: 480,
    maxHeight: '90%',
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
    fontSize: typography.fontSize.xl,
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
  content: {
    padding: spacing.md,
  },
  summaryCard: {
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  orderRef: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  totalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.primary,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.sm,
  },
  paymentMethods: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  paymentOptionSelected: {
    borderColor: lightColors.primary,
    backgroundColor: '#E3F2FD',
  },
  paymentOptionDisabled: {
    opacity: 0.5,
  },
  paymentIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  paymentLabelSelected: {
    color: lightColors.primary,
  },
  paymentDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 20,
    color: lightColors.primary,
    fontWeight: '700',
  },
  actions: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    gap: spacing.sm,
  },
  printButton: {
    marginBottom: spacing.xs,
  },
});

export default CheckoutModal;
