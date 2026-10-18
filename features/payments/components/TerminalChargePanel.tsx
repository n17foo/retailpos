import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';

interface TerminalChargePanelProps {
  terminalName: string | null;
  processing: boolean;
  amount: number;
  currencyCode: string;
  onDisconnect: () => void;
  onCharge: () => void;
}

/** Connected-terminal panel — shows the linked terminal and the charge button / spinner. */
export const TerminalChargePanel: React.FC<TerminalChargePanelProps> = ({
  terminalName,
  processing,
  amount,
  currencyCode,
  onDisconnect,
  onCharge,
}) => (
  <View style={styles.processingContainer}>
    <View style={styles.connectedTerminalRow}>
      <MaterialIcons name="check-circle" size={22} color={lightColors.success} />
      <Text style={styles.connectedText}>{terminalName}</Text>
      <TouchableOpacity
        onPress={onDisconnect}
        style={styles.disconnectButton}
        accessibilityLabel="Disconnect terminal"
        accessibilityRole="button"
      >
        <MaterialIcons name="link-off" size={18} color={lightColors.textSecondary} />
      </TouchableOpacity>
    </View>

    {processing ? (
      <View style={styles.processingIndicator}>
        <ActivityIndicator size="large" color={lightColors.primary} />
        <Text style={styles.processingText}>Processing payment…</Text>
        <Text style={styles.processingSubtext}>Present card to terminal</Text>
      </View>
    ) : (
      <TouchableOpacity
        style={styles.payButton}
        onPress={onCharge}
        accessibilityLabel={amount > 0 ? `Charge ${formatMoney(amount, currencyCode)}` : 'Process payment'}
        accessibilityRole="button"
      >
        <MaterialIcons name="payment" size={22} color={lightColors.textOnPrimary} />
        <Text style={styles.payButtonText}>{amount > 0 ? `Charge ${formatMoney(amount, currencyCode)}` : 'Process Payment'}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  connectedTerminalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  connectedText: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.success,
    fontWeight: '600',
  },
  disconnectButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButton: {
    backgroundColor: lightColors.success,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  payButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  processingIndicator: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  processingText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '500',
    color: lightColors.textPrimary,
    marginTop: spacing.sm,
  },
  processingSubtext: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
});
