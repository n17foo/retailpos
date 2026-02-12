import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { formatMoney } from '../utils/money';
import { useRefund } from '../hooks/useRefund';
import { RefundRecord } from '../services/refund/refundServiceInterface';
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

  const handleProcessRefund = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'Refund service is not initialized');
      return;
    }

    if (refundType === 'payment') {
      if (!transactionId || !amount) {
        Alert.alert('Error', 'Transaction ID and amount are required');
        return;
      }

      const result = await processPaymentRefund(transactionId, parseFloat(amount), reason);

      if (result.success) {
        Alert.alert('Success', `Refund processed successfully for $${amount}`);
        // Refresh refund history
        const history = await getRefundHistory(transactionId);
        setRefundHistory(history);
      } else {
        Alert.alert('Error', result.error || 'Failed to process refund');
      }
    } else {
      if (!orderId || !amount) {
        Alert.alert('Error', 'Order ID and amount are required');
        return;
      }

      const result = await processEcommerceRefund(orderId, {
        amount: parseFloat(amount),
        reason: reason,
      });

      if (result.success) {
        Alert.alert('Success', `E-commerce refund processed successfully for $${amount}`);
        // Refresh refund history
        const history = await getRefundHistory(orderId);
        setRefundHistory(history);
      } else {
        Alert.alert('Error', result.error || 'Failed to process e-commerce refund');
      }
    }
  };

  const renderRefundHistoryItem = ({ item }: { item: RefundRecord }) => (
    <View style={styles.historyItem}>
      <Text style={styles.historyId}>ID: {item.id}</Text>
      <Text style={styles.historyAmount}>Amount: {formatMoney(item.amount, currency.code)}</Text>
      <Text style={styles.historyDate}>Date: {item.timestamp.toLocaleString()}</Text>
      <Text style={styles.historySource}>Source: {item.source}</Text>
      <Text style={styles.historyStatus}>Status: {item.status}</Text>
      {item.reason && <Text style={styles.historyReason}>Reason: {item.reason}</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Process Refund</Text>
        {onGoBack && <Button title="← Back" variant="ghost" size="sm" onPress={onGoBack} />}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
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
    padding: spacing.md,
    backgroundColor: lightColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    color: lightColors.primary,
    fontSize: typography.fontSize.md,
  },
  errorContainer: {
    backgroundColor: lightColors.error + '20', // 20 is the hex for 12% opacity
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: lightColors.error,
  },
  refundTypeSelector: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  typeButton: {
    flex: 1,
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: lightColors.border,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  selectedType: {
    backgroundColor: lightColors.primary,
  },
  typeButtonText: {
    fontWeight: '500',
    color: lightColors.textPrimary,
  },
  selectedTypeText: {
    color: lightColors.textOnPrimary,
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
  historyId: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  historyAmount: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: lightColors.error,
    marginBottom: spacing.xs,
  },
  historyDate: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  historySource: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  historyStatus: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  historyReason: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontStyle: 'italic',
  },
});

export default RefundScreen;
