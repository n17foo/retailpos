import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';
import { SwipeablePanel } from '../../components/SwipeablePanel';
import { useBasketContext, CartItem } from '../../contexts/BasketProvider';
import { formatMoney } from '../../utils/money';
import { ECommercePlatform } from '../../utils/platforms';
import { useCurrency } from '../../hooks/useCurrency';
import { useTranslate } from '../../hooks/useTranslate';
import { CheckoutModal, PaymentMethod } from '../../components/CheckoutModal';

interface BasketProps {
  onCheckout?: () => void;
  onPaymentTerminal?: (orderId: string, amount: number) => void;
  onPrintReceipt?: (orderId: string) => void;
  platform?: ECommercePlatform;
}

export const Basket: React.FC<BasketProps> = ({ onCheckout, onPaymentTerminal, onPrintReceipt, platform }) => {
  const currency = useCurrency();
  const { t } = useTranslate();
  const {
    isRightPanelOpen,
    setIsRightPanelOpen,
    isLoading,
    cartItems,
    subtotal,
    tax,
    total,
    incrementQuantity,
    decrementQuantity,
    removeFromCart,
    startCheckout,
    markPaymentProcessing,
    completePayment,
    currentOrder,
    itemCount,
    unsyncedOrdersCount,
    syncAllPendingOrders,
  } = useBasketContext();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  // Handle quantity decrease
  const handleDecrement = async (itemId: string, currentQuantity: number) => {
    if (currentQuantity <= 1) {
      // Confirm removal
      Alert.alert(t('basket.removeItem'), t('basket.removeItemConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.remove'), style: 'destructive', onPress: () => removeFromCart(itemId) },
      ]);
    } else {
      await decrementQuantity(itemId);
    }
  };

  // Handle checkout process — opens CheckoutModal for payment method selection
  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    setIsProcessing(true);
    try {
      const order = await startCheckout(platform);
      if (!order) {
        Alert.alert(t('common.error'), t('basket.failedToCreateOrder'));
        return;
      }
      setCurrentOrderId(order.id);
      setCheckoutModalVisible(true);
    } catch (error) {
      Alert.alert(t('common.error'), (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle payment method selection from CheckoutModal
  const handlePayment = async (method: PaymentMethod) => {
    if (!currentOrderId) return;

    setIsProcessing(true);
    try {
      await markPaymentProcessing(currentOrderId);
      const paymentMethod = method === 'terminal' ? 'card_terminal' : method;
      const result = await completePayment(currentOrderId, paymentMethod);
      if (result.success) {
        setCheckoutModalVisible(false);
        setCurrentOrderId(null);
        setIsRightPanelOpen(false);
        onCheckout?.();
        if (onPrintReceipt) onPrintReceipt(currentOrderId);
      } else {
        Alert.alert(t('common.error'), result.error || t('basket.paymentFailed'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelCheckout = () => {
    setCheckoutModalVisible(false);
    setCurrentOrderId(null);
  };

  // Handle sync of pending orders
  const handleSyncOrders = async () => {
    setIsSyncing(true);
    try {
      const result = await syncAllPendingOrders();
      if (result.synced > 0) {
        Alert.alert(t('basket.syncCompleteTitle'), t('basket.syncComplete', { count: result.synced }));
      } else if (result.failed > 0) {
        Alert.alert(t('basket.syncFailedTitle'), t('basket.syncFailed', { count: result.failed }));
      } else {
        Alert.alert(t('basket.noOrdersTitle'), t('basket.noOrdersToSync'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), (error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Render each cart item
  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemPrice}>{formatMoney(item.price, currency.code)}</Text>
        {item.sku && <Text style={styles.itemSku}>{t('basket.sku', { sku: item.sku })}</Text>}
      </View>
      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => handleDecrement(item.id, item.quantity)}
          accessibilityLabel={`Decrease quantity of ${item.name}`}
          accessibilityRole="button"
        >
          <Text style={styles.quantityButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.quantity} accessibilityLabel={`Quantity: ${item.quantity}`}>
          {item.quantity}
        </Text>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => incrementQuantity(item.id)}
          accessibilityLabel={`Increase quantity of ${item.name}`}
          accessibilityRole="button"
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.itemTotal}>{formatMoney(item.price * item.quantity, currency.code)}</Text>
    </View>
  );

  return (
    <SwipeablePanel
      isOpen={isRightPanelOpen}
      onClose={() => setIsRightPanelOpen(false)}
      title={t('basket.title')}
      position="right"
      backgroundColor={lightColors.surface}
    >
      <View style={styles.panelContent}>
        <View style={styles.container}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={lightColors.primary} />
              <Text style={styles.loadingText}>{t('basket.loadingBasket')}</Text>
            </View>
          ) : cartItems.length === 0 ? (
            <View style={styles.emptyCart}>
              <Text style={styles.emptyCartText}>{t('basket.empty')}</Text>
            </View>
          ) : (
            <FlatList
              data={cartItems}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              style={styles.cartList}
              showsVerticalScrollIndicator={false}
            />
          )}

          <View style={styles.summary}>
            {/* Unsynced orders indicator */}
            {unsyncedOrdersCount > 0 && (
              <TouchableOpacity style={styles.syncBanner} onPress={handleSyncOrders} disabled={isSyncing}>
                <Text style={styles.syncBannerText}>
                  {isSyncing ? t('common.syncing') : t('basket.pendingSync', { count: unsyncedOrdersCount })}
                </Text>
                {isSyncing && <ActivityIndicator size="small" color={lightColors.textOnPrimary} />}
              </TouchableOpacity>
            )}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('basket.subtotal')}</Text>
              <Text style={styles.summaryValue}>{formatMoney(subtotal, currency.code)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('basket.tax', { rate: '8' })}</Text>
              <Text style={styles.summaryValue}>{formatMoney(tax, currency.code)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>{t('basket.total')}</Text>
              <Text style={styles.totalValue}>{formatMoney(total, currency.code)}</Text>
            </View>

            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.checkoutButton, (cartItems.length === 0 || isProcessing) && styles.buttonDisabled]}
                onPress={handleCheckout}
                disabled={cartItems.length === 0 || isProcessing}
                accessibilityLabel="Complete order"
                accessibilityRole="button"
                accessibilityHint="Opens a menu to complete the order in different ways"
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={lightColors.textOnPrimary} />
                ) : (
                  <Text style={styles.checkoutButtonText}>{t('basket.completeOrder')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <CheckoutModal
        visible={checkoutModalVisible}
        orderId={currentOrderId || ''}
        orderTotal={total}
        orderSubtotal={subtotal}
        orderTax={tax}
        itemCount={itemCount}
        onSelectPayment={handlePayment}
        onCancel={handleCancelCheckout}
        isProcessing={isProcessing}
      />
    </SwipeablePanel>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  cartList: {
    flex: 1,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    paddingVertical: spacing.sm,
  },
  panelContent: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: spacing.xs,
  },
  itemSku: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textHint,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  quantityButton: {
    width: 30,
    height: 30,
    backgroundColor: lightColors.keypadButton,
    borderRadius: borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
  },
  quantityButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  quantity: {
    fontSize: typography.fontSize.md,
    marginHorizontal: spacing.xs,
    minWidth: 20,
    textAlign: 'center',
  },
  summary: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    paddingTop: spacing.md,
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
  },
  totalRow: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    paddingTop: spacing.xs,
  },
  totalLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.primary,
  },
  checkoutButton: {
    backgroundColor: lightColors.success,
    padding: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: spacing.sm,
    minHeight: 48,
  },
  checkoutButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonsContainer: {
    marginTop: spacing.sm,
    width: '100%',
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyCartText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textHint,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginTop: spacing.md,
  },
  syncBanner: {
    backgroundColor: lightColors.warning,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncBannerText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
});
