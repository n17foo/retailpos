import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';
import { useBasketContext, CartItem } from '../../contexts/BasketProvider';
import { formatMoney } from '../../utils/money';
import { CheckoutModal, PaymentMethod } from '../../components/CheckoutModal';
import { StatusBadge } from '../../components/StatusBadge';
import { ECommercePlatform } from '../../utils/platforms';
import { useCurrency } from '../../hooks/useCurrency';
import CustomerSearchModal from '../../components/CustomerSearchModal';
import { PlatformCustomer } from '../../services/customer/CustomerServiceInterface';

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
  const currency = useCurrency();
  const {
    isLoading,
    basket,
    cartItems,
    subtotal,
    tax,
    total,
    itemCount,
    incrementQuantity,
    decrementQuantity,
    removeFromCart,
    setCustomer,
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
  const [customerModalVisible, setCustomerModalVisible] = useState(false);

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

  const handleSelectCustomer = async (customer: PlatformCustomer) => {
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
    await setCustomer(customer.email, name || customer.email);
    setCustomerModalVisible(false);
  };

  const handleRemoveCustomer = async () => {
    await setCustomer(undefined, undefined);
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
        <Text style={styles.itemPrice}>{formatMoney(item.price, currency.code)}</Text>
        {item.sku && <Text style={styles.itemSku}>{item.sku}</Text>}
      </View>
      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => handleDecrement(item.id, item.quantity)}
          accessibilityLabel={`Decrease quantity of ${item.name}`}
          accessibilityRole="button"
        >
          <Text style={styles.quantityButtonText}>−</Text>
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
      <View style={styles.itemRight}>
        <Text style={styles.itemTotal}>{formatMoney(item.price * item.quantity, currency.code)}</Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFromCart(item.id)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel={`Remove ${item.name} from cart`}
          accessibilityRole="button"
        >
          <MaterialIcons name="delete-outline" size={18} color={lightColors.error} />
        </TouchableOpacity>
      </View>
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

      {/* Customer section */}
      {basket?.customerEmail ? (
        <View style={styles.customerBadge}>
          <MaterialIcons name="person" size={16} color={lightColors.primary} />
          <View style={styles.customerBadgeInfo}>
            <Text style={styles.customerBadgeName} numberOfLines={1}>
              {basket.customerName || basket.customerEmail}
            </Text>
            {basket.customerName && (
              <Text style={styles.customerBadgeEmail} numberOfLines={1}>
                {basket.customerEmail}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleRemoveCustomer}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Remove customer"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={16} color={lightColors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addCustomerButton}
          onPress={() => setCustomerModalVisible(true)}
          accessibilityLabel="Add customer to order"
          accessibilityRole="button"
        >
          <MaterialIcons name="person-add" size={16} color={lightColors.primary} />
          <Text style={styles.addCustomerText}>Add Customer</Text>
        </TouchableOpacity>
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
          <Text style={styles.summaryValue}>{formatMoney(subtotal, currency.code)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax</Text>
          <Text style={styles.summaryValue}>{formatMoney(tax, currency.code)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(total, currency.code)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.checkoutButton, (cartItems.length === 0 || isProcessing) && styles.buttonDisabled]}
          onPress={handleStartCheckout}
          disabled={cartItems.length === 0 || isProcessing}
          accessibilityLabel={`Complete order, total ${formatMoney(total, currency.code)}`}
          accessibilityRole="button"
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={lightColors.textOnPrimary} />
          ) : (
            <View style={styles.checkoutButtonInner}>
              <Text style={styles.checkoutButtonLabel}>COMPLETE ORDER</Text>
              <Text style={styles.checkoutButtonTotal}>{formatMoney(total, currency.code)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Customer Search Modal */}
      <CustomerSearchModal
        visible={customerModalVisible}
        platform={platform}
        onSelect={handleSelectCustomer}
        onClose={() => setCustomerModalVisible(false)}
      />

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
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemTotal: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    minWidth: 56,
    textAlign: 'right',
  },
  removeButton: {
    padding: 2,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 56,
  },
  checkoutButtonInner: {
    alignItems: 'center',
    gap: 2,
  },
  checkoutButtonLabel: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  checkoutButtonTotal: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  customerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: lightColors.primary + '10',
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  customerBadgeInfo: {
    flex: 1,
  },
  customerBadgeName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  customerBadgeEmail: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  addCustomerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  addCustomerText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '600',
  },
});

export default BasketContent;
