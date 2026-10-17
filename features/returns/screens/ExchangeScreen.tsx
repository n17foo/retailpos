import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../../shared/utils/theme';
import { formatMoney, multiplyMoney, sumMoney } from '../../../shared/utils/money';
import { Button } from '../../../shared/components/Button';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import { ReturnService } from '../services/refunds/RefundService';
import { ExchangeService, ExchangeSession, ReturnLineInput } from '../services/exchange/ExchangeService';
import { PaymentMethod } from '../../orders-sync/services/order/order';
import { BasketServiceFactory } from '../../basket/services/BasketServiceFactory';
import { generateUUID } from '../../../shared/utils/uuid';
import type { MoreStackParamList } from '../../../app/navigation/types';

type ExchangeScreenRouteProp = RouteProp<MoreStackParamList, 'Exchange'>;

type ExchangeStep = 'select_returns' | 'add_items' | 'settle';

interface ReturnableItem {
  orderItemId: string;
  productId: string;
  variantId: string | null;
  name: string;
  price: number;
  originalQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
}

interface ReturnQty {
  [orderItemId: string]: number;
}

const METHOD_LABELS: Record<string, string> = {
  cash: '💵 Cash',
  card: '💳 Card',
  card_terminal: '📱 Terminal',
  store_credit: '🏷️ Store Credit',
  other: '🔄 Other',
};

const ExchangeScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ExchangeScreenRouteProp>();
  const currency = useCurrency();
  const { user } = useAuthContext();

  const orderId = route.params?.orderId ?? '';

  const [step, setStep] = useState<ExchangeStep>('select_returns');
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [returnQtys, setReturnQtys] = useState<ReturnQty>({});
  const [session, setSession] = useState<ExchangeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settle step state
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('cash');
  const [settleAmountStr, setSettleAmountStr] = useState('');

  // Load returnable items on mount
  useEffect(() => {
    if (!orderId) {
      setError('No order ID provided');
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        const items = await ReturnService.getInstance().getReturnableItems(orderId);
        setReturnableItems(items);
        const initial: ReturnQty = {};
        items.forEach(i => {
          initial[i.orderItemId] = 0;
        });
        setReturnQtys(initial);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order items');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [orderId]);

  const getExchangeService = useCallback(async (): Promise<ExchangeService> => {
    const container = await BasketServiceFactory.getInstance().getServices();
    return ExchangeService.getInstance(ReturnService.getInstance(), container.checkoutService);
  }, []);

  // ── Step 1: Select return items ──────────────────────────────────────

  const handleReturnQtyChange = useCallback(
    (orderItemId: string, delta: number) => {
      setReturnQtys(prev => {
        const item = returnableItems.find(i => i.orderItemId === orderItemId);
        if (!item) return prev;
        const current = prev[orderItemId] ?? 0;
        const next = Math.max(0, Math.min(item.returnableQuantity, current + delta));
        return { ...prev, [orderItemId]: next };
      });
    },
    [returnableItems]
  );

  const handleNextFromReturns = useCallback(async () => {
    const selectedItems: ReturnLineInput[] = returnableItems
      .filter(i => (returnQtys[i.orderItemId] ?? 0) > 0)
      .map(i => ({
        orderItemId: i.orderItemId,
        productId: i.productId,
        variantId: i.variantId ?? undefined,
        productName: i.name,
        quantity: returnQtys[i.orderItemId],
        price: i.price,
      }));

    if (selectedItems.length === 0) {
      setError('Select at least one item to return');
      return;
    }

    setError(null);
    const svc = await getExchangeService();
    const newSession = svc.createSession(orderId, selectedItems);
    setSession(newSession);
    setStep('add_items');
  }, [returnableItems, returnQtys, orderId, getExchangeService]);

  // ── Step 2: Add new items ────────────────────────────────────────────

  const handleAddProduct = useCallback(
    async (product: { id: string; name: string; price: number; variantId?: string; sku?: string }) => {
      if (!session) return;
      const svc = await getExchangeService();
      const item = {
        id: generateUUID(),
        productId: product.id,
        variantId: product.variantId,
        sku: product.sku,
        name: product.name,
        price: product.price,
        quantity: 1,
      };
      setSession(svc.addItem(session, item));
    },
    [session, getExchangeService]
  );

  const handleRemoveNewItem = useCallback(
    async (itemId: string) => {
      if (!session) return;
      const svc = await getExchangeService();
      setSession(svc.removeItem(session, itemId));
    },
    [session, getExchangeService]
  );

  const handleNextFromItems = useCallback(() => {
    setError(null);
    setStep('settle');
  }, []);

  // ── Step 3: Settle ───────────────────────────────────────────────────

  const handleAddPayment = useCallback(async () => {
    if (!session) return;
    const amount = parseFloat(settleAmountStr);
    if (isNaN(amount) || amount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    const remaining = session.remainingDue;
    if (amount > remaining + 0.001) {
      setError(`Amount exceeds remaining due (${formatMoney(remaining, currency.code)})`);
      return;
    }
    setError(null);
    const svc = await getExchangeService();
    setSession(svc.addPayment(session, { method: settleMethod, amount }));
    setSettleAmountStr('');
  }, [session, settleAmountStr, settleMethod, currency.code, getExchangeService]);

  const handleRemovePayment = useCallback(
    async (paymentId: string) => {
      if (!session) return;
      const svc = await getExchangeService();
      setSession(svc.removePayment(session, paymentId));
    },
    [session, getExchangeService]
  );

  const handleCompleteExchange = useCallback(async () => {
    if (!session) return;
    if (Math.abs(session.remainingDue) > 0.01) {
      setError('Exchange is not fully settled');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const svc = await getExchangeService();
      const result = await svc.confirm(session, user?.id, user?.username);
      if (result.success) {
        Alert.alert(
          'Exchange Complete',
          `Exchange completed successfully.${result.newOrderId ? `\nNew order: #${result.newOrderId.slice(-8)}` : ''}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        setError(result.error ?? 'Exchange failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exchange failed');
    } finally {
      setIsProcessing(false);
    }
  }, [session, user, getExchangeService, navigation]);

  // ── Render ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={lightColors.primary} />
      </View>
    );
  }

  if (!orderId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No order selected. Please open an exchange from Order History.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {(['select_returns', 'add_items', 'settle'] as ExchangeStep[]).map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                step === s && styles.stepDotActive,
                i < ['select_returns', 'add_items', 'settle'].indexOf(step) && styles.stepDotDone,
              ]}
            >
              <Text style={styles.stepDotText}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>
              {s === 'select_returns' ? 'Returns' : s === 'add_items' ? 'New Items' : 'Settle'}
            </Text>
          </View>
        ))}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color={lightColors.error} />
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={16} color={lightColors.error} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step 1: Select return items ── */}
      {step === 'select_returns' && (
        <View style={styles.stepContent}>
          <Text style={styles.sectionTitle}>Select items to return from order #{orderId.slice(-8)}</Text>
          {returnableItems.length === 0 ? (
            <Text style={styles.emptyText}>No returnable items found for this order.</Text>
          ) : (
            <FlatList
              data={returnableItems}
              keyExtractor={item => item.orderItemId}
              renderItem={({ item }) => {
                const qty = returnQtys[item.orderItemId] ?? 0;
                return (
                  <View style={styles.returnItem}>
                    <View style={styles.returnItemInfo}>
                      <Text style={styles.returnItemName}>{item.name}</Text>
                      <Text style={styles.returnItemPrice}>
                        {formatMoney(item.price, currency.code)} × {item.returnableQuantity} available
                      </Text>
                    </View>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => handleReturnQtyChange(item.orderItemId, -1)}
                        disabled={qty === 0}
                        accessibilityLabel="Decrease quantity"
                        accessibilityRole="button"
                      >
                        <Text style={[styles.qtyButtonText, qty === 0 && styles.qtyButtonDisabled]}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{qty}</Text>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => handleReturnQtyChange(item.orderItemId, 1)}
                        disabled={qty >= item.returnableQuantity}
                        accessibilityLabel="Increase quantity"
                        accessibilityRole="button"
                      >
                        <Text style={[styles.qtyButtonText, qty >= item.returnableQuantity && styles.qtyButtonDisabled]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              style={styles.list}
            />
          )}
          <View style={styles.footer}>
            <Text style={styles.creditSummary}>
              Return credit:{' '}
              {formatMoney(sumMoney(returnableItems.map(i => multiplyMoney(i.price, returnQtys[i.orderItemId] ?? 0))), currency.code)}
            </Text>
            <Button
              title="Next: Add New Items"
              variant="primary"
              fullWidth
              onPress={handleNextFromReturns}
              disabled={Object.values(returnQtys).every(q => q === 0)}
            />
          </View>
        </View>
      )}

      {/* ── Step 2: Add new items ── */}
      {step === 'add_items' && session && (
        <View style={styles.stepContent}>
          <View style={styles.netDueBanner}>
            <Text style={styles.netDueLabel}>
              {session.netDue > 0.01
                ? `Amount due: ${formatMoney(session.netDue, currency.code)}`
                : session.netDue < -0.01
                  ? `Refund due: ${formatMoney(Math.abs(session.netDue), currency.code)}`
                  : 'No payment required'}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>New items in exchange</Text>
          {session.newItems.length === 0 ? (
            <Text style={styles.emptyText}>No new items added yet. Use the buttons below to add products.</Text>
          ) : (
            <FlatList
              data={session.newItems}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.newItem}>
                  <View style={styles.returnItemInfo}>
                    <Text style={styles.returnItemName}>{item.name}</Text>
                    <Text style={styles.returnItemPrice}>
                      {formatMoney(item.price, currency.code)} × {item.quantity}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveNewItem(item.id)}
                    style={styles.removeButton}
                    accessibilityLabel="Remove item"
                    accessibilityRole="button"
                  >
                    <MaterialIcons name="delete-outline" size={20} color={lightColors.error} />
                  </TouchableOpacity>
                </View>
              )}
              style={styles.list}
            />
          )}

          {/* Quick-add demo products — in a real implementation this would be a product search */}
          <View style={styles.addItemHint}>
            <MaterialIcons name="info-outline" size={16} color={lightColors.textSecondary} />
            <Text style={styles.addItemHintText}>
              Tap "Add Sample Item" to add a product. In production, integrate with the product catalogue.
            </Text>
          </View>
          <Button
            title="+ Add Sample Item ($10.00)"
            variant="outline"
            fullWidth
            onPress={() => handleAddProduct({ id: generateUUID(), name: 'Exchange Item', price: 10.0 })}
            style={styles.addItemButton}
          />

          <View style={styles.footer}>
            <Button title="Next: Settle Payment" variant="primary" fullWidth onPress={handleNextFromItems} />
          </View>
        </View>
      )}

      {/* ── Step 3: Settle ── */}
      {step === 'settle' && session && (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          {/* Summary */}
          <View style={styles.settleSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Return credit</Text>
              <Text style={[styles.summaryValue, { color: lightColors.success }]}>−{formatMoney(session.returnCredit, currency.code)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>New items total</Text>
              <Text style={styles.summaryValue}>{formatMoney(session.newItemsTotal, currency.code)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>{session.netDue >= 0 ? 'Net due' : 'Refund due'}</Text>
              <Text style={[styles.summaryTotalValue, { color: session.netDue >= 0 ? lightColors.textPrimary : lightColors.success }]}>
                {formatMoney(Math.abs(session.netDue), currency.code)}
              </Text>
            </View>
          </View>

          {/* Collected payments */}
          {session.payments.length > 0 && (
            <View style={styles.paymentsSection}>
              <Text style={styles.sectionTitle}>Payments collected</Text>
              {session.payments.map(p => (
                <View key={p.id} style={styles.paymentLine}>
                  <Text style={styles.paymentLineMethod}>{METHOD_LABELS[p.method] ?? p.method}</Text>
                  <Text style={styles.paymentLineAmount}>{formatMoney(p.amount, currency.code)}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemovePayment(p.id)}
                    style={styles.removeButton}
                    accessibilityLabel="Remove payment"
                    accessibilityRole="button"
                  >
                    <MaterialIcons name="close" size={18} color={lightColors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Remaining */}
          <View
            style={[
              styles.remainingRow,
              { backgroundColor: session.remainingDue <= 0.01 ? lightColors.success + '20' : lightColors.error + '15' },
            ]}
          >
            <Text style={styles.remainingLabel}>Remaining</Text>
            <Text style={[styles.remainingValue, { color: session.remainingDue <= 0.01 ? lightColors.success : lightColors.error }]}>
              {formatMoney(Math.max(0, session.remainingDue), currency.code)}
            </Text>
          </View>

          {/* Add payment */}
          {session.remainingDue > 0.01 && (
            <View style={styles.addPaymentSection}>
              <Text style={styles.sectionTitle}>Add payment</Text>
              <View style={styles.methodRow}>
                {(['cash', 'card', 'card_terminal', 'store_credit', 'other'] as PaymentMethod[]).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodButton, settleMethod === m && styles.methodButtonSelected]}
                    onPress={() => setSettleMethod(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: settleMethod === m }}
                  >
                    <Text style={[styles.methodButtonText, settleMethod === m && styles.methodButtonTextSelected]}>
                      {METHOD_LABELS[m] ?? m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.amountInput}
                value={settleAmountStr}
                onChangeText={setSettleAmountStr}
                placeholder={`Amount (max ${formatMoney(session.remainingDue, currency.code)})`}
                keyboardType="decimal-pad"
                accessibilityLabel="Payment amount"
              />
              <Button
                title="Add Payment"
                variant="primary"
                fullWidth
                onPress={handleAddPayment}
                disabled={!settleAmountStr || isProcessing}
              />
            </View>
          )}

          <View style={styles.footer}>
            <Button
              title={isProcessing ? 'Processing…' : 'Complete Exchange'}
              variant="success"
              size="lg"
              fullWidth
              onPress={handleCompleteExchange}
              loading={isProcessing}
              disabled={isProcessing || session.remainingDue > 0.01}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    gap: spacing.xl,
  },
  stepItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: lightColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: lightColors.primary,
  },
  stepDotDone: {
    backgroundColor: lightColors.success,
  },
  stepDotText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: lightColors.surface,
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  stepLabelActive: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    margin: spacing.md,
    marginBottom: 0,
    padding: spacing.sm,
    backgroundColor: lightColors.error + '15',
    borderRadius: borderRadius.sm,
  },
  errorBannerText: {
    flex: 1,
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
  },
  errorText: {
    color: lightColors.error,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
  },
  stepContent: {
    flex: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyText: {
    color: lightColors.textSecondary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  list: {
    flex: 1,
  },
  returnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...elevation.low,
  },
  returnItemInfo: {
    flex: 1,
  },
  returnItemName: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  returnItemPrice: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lightColors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.primary,
  },
  qtyButtonDisabled: {
    color: lightColors.textDisabled,
  },
  qtyValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    marginTop: spacing.sm,
  },
  creditSummary: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.success,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  netDueBanner: {
    backgroundColor: lightColors.primary + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  netDueLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.primary,
  },
  newItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...elevation.low,
  },
  removeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  addItemHintText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  addItemButton: {
    marginBottom: spacing.sm,
  },
  settleSummary: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
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
    fontWeight: '500',
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  summaryTotalLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  summaryTotalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  paymentsSection: {
    marginBottom: spacing.md,
  },
  paymentLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...elevation.low,
  },
  paymentLineMethod: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    fontWeight: '500',
  },
  paymentLineAmount: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginRight: spacing.sm,
  },
  remainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  remainingLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  remainingValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
  },
  addPaymentSection: {
    marginBottom: spacing.md,
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  methodButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  methodButtonSelected: {
    borderColor: lightColors.primary,
    backgroundColor: lightColors.primary + '15',
  },
  methodButtonText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '500',
  },
  methodButtonTextSelected: {
    color: lightColors.primary,
    fontWeight: '700',
  },
  amountInput: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.surface,
    marginBottom: spacing.sm,
  },
});

export default ExchangeScreen;
