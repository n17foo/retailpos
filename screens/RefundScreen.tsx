import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { formatMoney } from '../utils/money';
import { useRefund } from '../hooks/useRefund';
import { RefundRecord } from '../services/refund/RefundServiceInterface';
import { Button } from '../components/Button';
import Input from '../components/Input';
import { useCurrency } from '../hooks/useCurrency';

interface RefundScreenProps {
  onGoBack?: () => void;
}

const RefundScreen: React.FC<RefundScreenProps> = ({ onGoBack }) => {
  const currency = useCurrency();
  const { isInitialized, isLoading, error, processPaymentRefund, processEcommerceRefund, getRefundHistory } = useRefund();
  const [refundType, setRefundType] = useState<'payment' | 'ecommerce'>('payment');
  const [orderId, setOrderId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [refundHistory, setRefundHistory] = useState<RefundRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch refund history when order/transaction ID changes
  useEffect(() => {
    async function fetchRefundHistory() {
      if (!orderId && !transactionId) return;

      try {
        setHistoryLoading(true);
        const id = refundType === 'ecommerce' ? orderId : transactionId;
        if (id) {
          const history = await getRefundHistory(id);
          setRefundHistory(history);
        }
      } catch (err) {
        console.error('Failed to fetch refund history:', err);
      } finally {
        setHistoryLoading(false);
      }
    }

    fetchRefundHistory();
  }, [orderId, transactionId, refundType, getRefundHistory]);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleProcessRefund = async () => {
    setFormError(null);
    setSuccessMsg(null);

    if (!isInitialized) {
      setFormError('Refund service is not initialized.');
      return;
    }

    if (refundType === 'payment') {
      if (!transactionId || !amount) {
        setFormError('Transaction ID and amount are required.');
        return;
      }

      const result = await processPaymentRefund(transactionId, parseFloat(amount), reason);

      if (result.success) {
        setSuccessMsg(`Refund of ${formatMoney(parseFloat(amount), currency.code)} processed successfully.`);
        const history = await getRefundHistory(transactionId);
        setRefundHistory(history);
        setAmount('');
        setReason('');
      } else {
        setFormError(result.error || 'Failed to process refund.');
      }
    } else {
      if (!orderId || !amount) {
        setFormError('Order ID and amount are required.');
        return;
      }

      const result = await processEcommerceRefund(orderId, {
        amount: parseFloat(amount),
        reason: reason,
      });

      if (result.success) {
        setSuccessMsg(`E-commerce refund of ${formatMoney(parseFloat(amount), currency.code)} processed successfully.`);
        const history = await getRefundHistory(orderId);
        setRefundHistory(history);
        setAmount('');
        setReason('');
      } else {
        setFormError(result.error || 'Failed to process e-commerce refund.');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return lightColors.success;
      case 'failed':
        return lightColors.error;
      default:
        return lightColors.warning;
    }
  };

  const renderRefundHistoryItem = ({ item }: { item: RefundRecord }) => {
    const statusColor = getStatusColor(item.status);
    return (
      <View style={styles.historyItem}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyId}>#{item.id.slice(-8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.historyAmount}>{formatMoney(item.amount, currency.code)}</Text>
        <Text style={styles.historyMeta}>
          {item.timestamp.toLocaleString()} · {item.source}
        </Text>
        {item.reason && <Text style={styles.historyReason}>{item.reason}</Text>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onGoBack && (
          <TouchableOpacity onPress={onGoBack} style={styles.backButton} accessibilityLabel="Go back" accessibilityRole="button">
            <MaterialIcons name="arrow-back" size={24} color={lightColors.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Process Refund</Text>
      </View>

      {(error || formError) && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={16} color={lightColors.error} />
          <Text style={styles.errorText}>{formError || error}</Text>
          <TouchableOpacity onPress={() => setFormError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={16} color={lightColors.error} />
          </TouchableOpacity>
        </View>
      )}

      {successMsg && (
        <View style={styles.successContainer}>
          <MaterialIcons name="check-circle" size={16} color={lightColors.success} />
          <Text style={styles.successText}>{successMsg}</Text>
        </View>
      )}

      <View style={styles.refundTypeSelector}>
        <Button
          title="Payment Refund"
          variant={refundType === 'payment' ? 'primary' : 'outline'}
          onPress={() => setRefundType('payment')}
          style={styles.typeButton}
        />
        <Button
          title="E-commerce Refund"
          variant={refundType === 'ecommerce' ? 'primary' : 'outline'}
          onPress={() => setRefundType('ecommerce')}
          style={styles.typeButton}
        />
      </View>

      <View style={styles.formContainer}>
        {refundType === 'payment' ? (
          <Input label="Transaction ID" placeholder="Enter transaction ID" value={transactionId} onChangeText={setTransactionId} required />
        ) : (
          <Input label="Order ID" placeholder="Enter order ID" value={orderId} onChangeText={setOrderId} required />
        )}

        <Input
          label="Amount"
          placeholder="Enter refund amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          required
        />

        <Input
          label="Reason"
          placeholder="Reason for refund (optional)"
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={3}
        />

        <Button
          title="Process Refund"
          variant="danger"
          fullWidth
          loading={isLoading}
          disabled={!isInitialized}
          onPress={handleProcessRefund}
        />
      </View>

      <View style={styles.historyContainer}>
        <Text style={styles.sectionTitle}>Refund History</Text>
        {historyLoading ? (
          <ActivityIndicator style={styles.historyLoader} />
        ) : refundHistory.length > 0 ? (
          <FlatList data={refundHistory} renderItem={renderRefundHistoryItem} keyExtractor={item => item.id} />
        ) : (
          <Text style={styles.emptyHistoryText}>No refund history available</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    margin: spacing.md,
    marginBottom: 0,
    padding: spacing.sm,
    backgroundColor: lightColors.error + '15',
    borderRadius: borderRadius.sm,
  },
  errorText: {
    flex: 1,
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    margin: spacing.md,
    marginBottom: 0,
    padding: spacing.sm,
    backgroundColor: lightColors.success + '15',
    borderRadius: borderRadius.sm,
  },
  successText: {
    flex: 1,
    color: lightColors.success,
    fontSize: typography.fontSize.sm,
  },
  scrollContent: {
    padding: spacing.md,
  },
  refundTypeSelector: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  typeButton: {
    flex: 1,
  },
  formContainer: {
    backgroundColor: lightColors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...elevation.low,
    marginBottom: spacing.md,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  reasonInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  processButton: {
    backgroundColor: lightColors.primary,
    height: 48,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: lightColors.textDisabled,
  },
  processButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
  historyContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '500',
    marginBottom: spacing.xs,
    color: lightColors.textPrimary,
  },
  historyLoader: {
    marginTop: spacing.lg,
  },
  emptyHistoryText: {
    textAlign: 'center',
    marginTop: spacing.lg,
    color: lightColors.textSecondary,
  },
  historyItem: {
    backgroundColor: lightColors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    ...elevation.low,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  historyId: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  historyAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.error,
    marginBottom: spacing.xs,
  },
  historyMeta: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  historyReason: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});

export default RefundScreen;
