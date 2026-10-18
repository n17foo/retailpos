import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../../shared/utils/theme';
import { formatMoney, multiplyMoney } from '../../../shared/utils/money';
import { useRefund } from '../hooks/useRefund';
import { RefundRecord } from '../services/refunds/RefundService';
import { Button } from '../../../shared/components/Button';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { useLogger } from '../../../shared/hooks/useLogger';
import { useManagerApproval } from '../../authentication/hooks/useManagerApproval';
import { AmountRefundForm } from '../components/AmountRefundForm';
import { ReturnItemsForm, ReturnItemInput } from '../components/ReturnItemsForm';
import { RefundHistoryList } from '../components/RefundHistoryList';
import type { ReturnableItem } from '../components/ExchangeReturnItemsStep';

interface ReturnsScreenProps {
  onGoBack?: () => void;
}

const RefundScreen: React.FC<ReturnsScreenProps> = ({ onGoBack }) => {
  const currency = useCurrency();
  const {
    isInitialized,
    isLoading,
    error,
    processPaymentRefund,
    processEcommerceRefund,
    processReturn,
    getRefundHistory,
    getReturnableItems,
  } = useRefund();
  const { requestApproval, isApproving } = useManagerApproval();
  const [refundType, setRefundType] = useState<'payment' | 'ecommerce' | 'return'>('payment');
  const [orderId, setOrderId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [refundHistory, setRefundHistory] = useState<RefundRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const logger = useLogger('ReturnsScreen');

  // Return-specific state
  const [returnItems, setReturnItems] = useState<ReturnItemInput[]>([]);
  const [issueRefund, setIssueRefund] = useState(true);
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [loadingReturnableItems, setLoadingReturnableItems] = useState(false);

  // Fetch refund history when order/transaction ID changes
  useEffect(() => {
    async function fetchRefundHistory() {
      if (!orderId && !transactionId) return;

      try {
        setHistoryLoading(true);
        const id = refundType === 'ecommerce' || refundType === 'return' ? orderId : transactionId;
        if (id) {
          const history = await getRefundHistory(id);
          setRefundHistory(history);
        }
      } catch (err) {
        logger.error('Failed to fetch refund history:', err instanceof Error ? err : new Error(String(err)));
      } finally {
        setHistoryLoading(false);
      }
    }

    fetchRefundHistory();
  }, [orderId, transactionId, refundType, getRefundHistory, logger]);

  // Fetch returnable items when order ID changes and return type is selected
  useEffect(() => {
    async function fetchReturnableItems() {
      if (refundType !== 'return' || !orderId) {
        setReturnableItems([]);
        return;
      }

      try {
        setLoadingReturnableItems(true);
        const items = await getReturnableItems(orderId);
        setReturnableItems(items);
      } catch (err) {
        logger.error('Failed to fetch returnable items:', err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoadingReturnableItems(false);
      }
    }

    fetchReturnableItems();
  }, [orderId, refundType, getReturnableItems, logger]);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleProcessRefund = async () => {
    setFormError(null);
    setSuccessMsg(null);

    if (!isInitialized) {
      setFormError('Returns service is not initialized.');
      return;
    }

    // Spec requirement 2.2: Request manager approval for refund:process action
    const approved = await requestApproval('refund:process');
    if (!approved) {
      setFormError('Manager approval required to process refunds.');
      return;
    }

    if (refundType === 'payment') {
      if (!transactionId || !amount) {
        setFormError('Transaction ID and amount are required.');
        return;
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setFormError('Amount must be a positive number.');
        return;
      }

      const result = await processPaymentRefund(transactionId, parsedAmount, reason);

      if (result.success) {
        setSuccessMsg(`Refund of ${formatMoney(parsedAmount, currency.code)} processed successfully.`);
        const history = await getRefundHistory(transactionId);
        setRefundHistory(history);
        setAmount('');
        setReason('');
      } else {
        setFormError(result.error || 'Failed to process refund.');
      }
    } else if (refundType === 'ecommerce') {
      if (!orderId || !amount) {
        setFormError('Order ID and amount are required.');
        return;
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setFormError('Amount must be a positive number.');
        return;
      }

      const result = await processEcommerceRefund(orderId, {
        amount: parsedAmount,
        reason: reason,
      });

      if (result.success) {
        setSuccessMsg(`E-commerce refund of ${formatMoney(parsedAmount, currency.code)} processed successfully.`);
        const history = await getRefundHistory(orderId);
        setRefundHistory(history);
        setAmount('');
        setReason('');
      } else {
        setFormError(result.error || 'Failed to process e-commerce refund.');
      }
    } else {
      // Return processing
      if (!orderId) {
        setFormError('Order ID is required.');
        return;
      }

      if (returnItems.length === 0) {
        setFormError('Please add at least one item to return.');
        return;
      }

      const result = await processReturn({
        orderId,
        items: returnItems,
        issueRefund,
      });

      if (result.success) {
        setSuccessMsg(
          `Return processed. ${result.returnIds.length} item(s) returned${issueRefund ? ` with refund of ${formatMoney(result.totalRefund, currency.code)}` : ''}.`
        );
        const history = await getRefundHistory(orderId);
        setRefundHistory(history);
        setReturnItems([]);
        setReason('');
      } else {
        setFormError(result.error || 'Failed to process return.');
      }
    }
  };

  const addReturnItem = (item: ReturnableItem) => {
    setReturnItems([
      ...returnItems,
      {
        orderItemId: item.orderItemId,
        productId: item.productId,
        variantId: item.variantId || undefined,
        productName: item.name,
        quantity: 1,
        refundAmount: item.price,
        reason: reason || undefined,
        restock: true,
      },
    ]);
  };

  const removeReturnItem = (index: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const updateReturnItemQuantity = (index: number, quantity: number) => {
    const newItems = [...returnItems];
    const item = returnItems[index];
    const returnableItem = returnableItems.find(ri => ri.orderItemId === item.orderItemId);
    const maxQuantity = returnableItem?.returnableQuantity || 1;
    const clampedQty = Math.min(Math.max(1, quantity), maxQuantity);
    const unitPrice = returnableItem?.price ?? item.refundAmount / item.quantity;

    newItems[index] = {
      ...item,
      quantity: clampedQty,
      refundAmount: multiplyMoney(unitPrice, clampedQty),
    };
    setReturnItems(newItems);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onGoBack && (
          <TouchableOpacity onPress={onGoBack} style={styles.backButton} accessibilityLabel="Go back" accessibilityRole="button">
            <MaterialIcons name="arrow-back" size={24} color={lightColors.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Returns & Refunds</Text>
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
        <Button
          title="Return with Refund"
          variant={refundType === 'return' ? 'primary' : 'outline'}
          onPress={() => setRefundType('return')}
          style={styles.typeButton}
        />
      </View>

      <ScrollView style={styles.formScrollContainer}>
        <View style={styles.formContainer}>
          {refundType === 'return' ? (
            <ReturnItemsForm
              orderId={orderId}
              returnableItems={returnableItems}
              isLoadingReturnable={loadingReturnableItems}
              returnItems={returnItems}
              issueRefund={issueRefund}
              reason={reason}
              currencyCode={currency.code}
              onOrderIdChange={setOrderId}
              onAddItem={addReturnItem}
              onRemoveItem={removeReturnItem}
              onUpdateItemQuantity={updateReturnItemQuantity}
              onIssueRefundChange={setIssueRefund}
              onReasonChange={setReason}
            />
          ) : (
            <AmountRefundForm
              idLabel={refundType === 'payment' ? 'Transaction ID' : 'Order ID'}
              idPlaceholder={refundType === 'payment' ? 'Enter transaction ID' : 'Enter order ID'}
              idValue={refundType === 'payment' ? transactionId : orderId}
              amount={amount}
              reason={reason}
              onIdChange={refundType === 'payment' ? setTransactionId : setOrderId}
              onAmountChange={setAmount}
              onReasonChange={setReason}
            />
          )}

          <Button
            title={refundType === 'return' ? 'Process Return' : 'Process Refund'}
            variant="danger"
            fullWidth
            loading={isLoading || isApproving}
            disabled={!isInitialized || isApproving}
            onPress={handleProcessRefund}
          />
        </View>
      </ScrollView>

      <RefundHistoryList history={refundHistory} isLoading={historyLoading} currencyCode={currency.code} />
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
  refundTypeSelector: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  typeButton: {
    flex: 1,
  },
  formScrollContainer: {
    flex: 1,
    marginBottom: spacing.md,
  },
  formContainer: {
    backgroundColor: lightColors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...elevation.low,
    marginBottom: spacing.md,
  },
});

export default RefundScreen;
