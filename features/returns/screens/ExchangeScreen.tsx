import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { lightColors, spacing, typography, borderRadius } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import { ReturnService } from '../services/refunds/RefundService';
import { ExchangeService, ExchangeSession, ReturnLineInput } from '../services/exchange/ExchangeService';
import { PaymentMethod } from '../../orders-sync/services/order/order';
import { BasketServiceFactory } from '../../basket/services/BasketServiceFactory';
import { generateUUID } from '../../../shared/utils/uuid';
import type { MoreStackParamList } from '../../../app/navigation/types';
import { ExchangeStepIndicator, ExchangeStep } from '../components/ExchangeStepIndicator';
import { ExchangeReturnItemsStep, ReturnableItem } from '../components/ExchangeReturnItemsStep';
import { ExchangeAddItemsStep, ExchangeProductInput } from '../components/ExchangeAddItemsStep';
import { ExchangeSettleStep } from '../components/ExchangeSettleStep';

type ExchangeScreenRouteProp = RouteProp<MoreStackParamList, 'Exchange'>;

type ReturnQty = Record<string, number>;

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
    async (product: ExchangeProductInput) => {
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
      <ExchangeStepIndicator step={step} />

      {error && (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color={lightColors.error} />
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={16} color={lightColors.error} />
          </TouchableOpacity>
        </View>
      )}

      {step === 'select_returns' && (
        <ExchangeReturnItemsStep
          orderId={orderId}
          items={returnableItems}
          quantities={returnQtys}
          currencyCode={currency.code}
          onQuantityChange={handleReturnQtyChange}
          onNext={handleNextFromReturns}
        />
      )}

      {step === 'add_items' && session && (
        <ExchangeAddItemsStep
          session={session}
          currencyCode={currency.code}
          onAddProduct={handleAddProduct}
          onRemoveItem={handleRemoveNewItem}
          onNext={handleNextFromItems}
        />
      )}

      {step === 'settle' && session && (
        <ExchangeSettleStep
          session={session}
          currencyCode={currency.code}
          settleMethod={settleMethod}
          settleAmountStr={settleAmountStr}
          isProcessing={isProcessing}
          onMethodChange={setSettleMethod}
          onAmountChange={setSettleAmountStr}
          onAddPayment={handleAddPayment}
          onRemovePayment={handleRemovePayment}
          onComplete={handleCompleteExchange}
        />
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
});

export default ExchangeScreen;
