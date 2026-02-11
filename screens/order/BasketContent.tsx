import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';
import { useBasketContext, CartItem } from '../../contexts/BasketProvider';
import { CheckoutModal, PaymentMethod } from '../../components/CheckoutModal';
import { StatusBadge } from '../../components/StatusBadge';
import { ECommercePlatform } from '../../utils/platforms';

interface BasketContentProps {
  platform?: ECommercePlatform;
  onCheckout?: () => void;
  onPrintReceipt?: (orderId: string) => void;
}

/**
 * Basket content component that can be used both inline (sidebar) and in a SwipeablePanel.
 * Replaces Alert-based checkout with a proper CheckoutModal.
 */
export const BasketContent: React.FC<BasketContentProps> = ({ platform, onCheckout, onPrintReceipt }) => {
  const {
    isLoading,
    cartItems,
    subtotal,
    tax,
    total,
    itemCount,
    incrementQuantity,
    decrementQuantity,
    removeFromCart,
    startCheckout,
    markPaymentProcessing,
    completePayment,
    unsyncedOrdersCount,
    syncAllPendingOrders,
  } = useBasketContext();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  const handleDecrement = async (itemId: string, currentQuantity: number) => {
    if (currentQuantity <= 1) {
      await removeFromCart(itemId);
    } else {
      await decrementQuantity(itemId);
    }
  };

  const handleStartCheckout = async () => {
    if (cartItems.length === 0) return;

    setIsProcessing(true);
    try {
      const order = await startCheckout(platform);
      if (order) {
        setCurrentOrderId(order.id);
        setCheckoutModalVisible(true);
      }
    } catch {
      // Error handled by context
    } finally {
      setIsProcessing(false);
    }
  };

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
        onCheckout?.();
      }
    } catch {
      // Error handled by context
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelCheckout = () => {
    setCheckoutModalVisible(false);
    setCurrentOrderId(null);
  };

  const handleSyncOrders = async () => {
    setIsSyncing(true);
    try {
      await syncAllPendingOrders();
    } finally {
      setIsSyncing(false);
    }
  };

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
        {item.sku && <Text style={styles.itemSku}>SKU: {item.sku}</Text>}
      </View>
      <View style={styles.quantityContainer}>
        <TouchableOpacity style={styles.quantityButton} onPress={() => handleDecrement(item.id, item.quantity)}>
          <Text style={styles.quantityButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity style={styles.quantityButton} onPress={() => incrementQuantity(item.id)}>
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.itemTotal}>${(item.price * item.quantity).toFixed(2)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={lightColors.primary} />
          <Text style={styles.loadingText}>Loading basket...</Text>
        </View>
      ) : cartItems.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Text style={styles.emptyHint}>Tap a product to add it</Text>
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

      {/* Summary & Actions */}
      <View style={styles.summary}>
        {unsyncedOrdersCount > 0 && (
          <TouchableOpacity style={styles.syncBanner} onPress={handleSyncOrders} disabled={isSyncing}>
            <StatusBadge status="pending" label={isSyncing ? 'Syncing...' : `${unsyncedOrdersCount} pending sync`} />
            {isSyncing && <ActivityIndicator size="small" color={lightColors.textOnPrimary} />}
          </TouchableOpacity>
        )}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax</Text>
          <Text style={styles.summaryValue}>${tax.toFixed(2)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.checkoutButton, (cartItems.length === 0 || isProcessing) && styles.buttonDisabled]}
          onPress={handleStartCheckout}
          disabled={cartItems.length === 0 || isProcessing}
          accessibilityLabel="Complete order"
          accessibilityRole="button"
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={lightColors.textOnPrimary} />
          ) : (
            <Text style={styles.checkoutButtonText}>COMPLETE ORDER — ${total.toFixed(2)}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Checkout Modal */}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
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
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textHint,
    marginTop: spacing.xs,
  },
  cartList: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    paddingVertical: spacing.sm,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  itemSku: {
    fontSize: 10,
    color: lightColors.textHint,
    marginTop: 1,
  },
  itemTotal: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    minWidth: 56,
    textAlign: 'right',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  quantityButton: {
    width: 28,
    height: 28,
    backgroundColor: lightColors.keypadButton,
    borderRadius: borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  quantityButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
  },
  quantity: {
    fontSize: typography.fontSize.sm,
    marginHorizontal: spacing.xs,
    minWidth: 18,
    textAlign: 'center',
  },
  summary: {
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    padding: spacing.md,
    backgroundColor: lightColors.surface,
  },
  syncBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.sm,
  },
  totalRow: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    paddingTop: spacing.sm,
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
    marginTop: spacing.sm,
    minHeight: 48,
  },
  checkoutButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default BasketContent;
