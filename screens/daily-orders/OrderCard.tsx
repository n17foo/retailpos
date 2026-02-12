import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../utils/theme';
import { formatMoney } from '../../utils/money';
import { LocalOrder } from '../../services/basket/BasketServiceInterface';
import { useCurrency } from '../../hooks/useCurrency';

interface OrderCardProps {
  order: LocalOrder;
  isSyncing: boolean;
  onResync: (orderId: string) => void;
  onPrintReceipt: (order: LocalOrder) => void;
}

const getOrderStatusColor = (order: LocalOrder) => {
  if (order.syncStatus === 'synced') return lightColors.success;
  if (order.syncStatus === 'failed') return lightColors.error;
  return lightColors.warning;
};

const getOrderStatusText = (order: LocalOrder) => {
  if (order.syncStatus === 'synced') return 'Synced';
  if (order.syncStatus === 'failed') return 'Failed';
  return 'Pending';
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, isSyncing, onResync, onPrintReceipt }) => {
  const currency = useCurrency();
  const statusColor = getOrderStatusColor(order);

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>Order #{order.id.slice(-8)}</Text>
          <Text style={styles.orderTime}>{order.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{getOrderStatusText(order)}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <Text style={styles.customerInfo}>
          {order.customerName || 'Guest'} • {formatMoney(order.total, currency.code)}
        </Text>
        <Text style={styles.itemCount}>
          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {order.syncStatus === 'failed' && order.syncError && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={16} color={lightColors.error} />
          <Text style={styles.errorText}>{order.syncError}</Text>
        </View>
      )}

      <View style={styles.orderActions}>
        <TouchableOpacity style={styles.printButton} onPress={() => onPrintReceipt(order)}>
          <MaterialIcons name="print" size={16} color={lightColors.primary} />
          <Text style={styles.printButtonText}>Print</Text>
        </TouchableOpacity>

        {order.syncStatus !== 'synced' && (
          <TouchableOpacity
            style={[styles.resyncButton, isSyncing && styles.resyncButtonDisabled]}
            onPress={() => onResync(order.id)}
            disabled={isSyncing}
          >
            <MaterialIcons name={isSyncing ? 'sync' : 'sync-problem'} size={16} color={lightColors.surface} />
            <Text style={styles.resyncButtonText}>{isSyncing ? 'Syncing...' : 'Resync'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  orderCard: {
    backgroundColor: lightColors.surface,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...elevation.low,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  orderTime: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  customerInfo: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
  itemCount: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: lightColors.error + '10',
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: lightColors.error,
    flex: 1,
  },
  orderActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.primary + '20',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    flex: 1,
  },
  printButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.primary,
  },
  resyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  resyncButtonDisabled: {
    backgroundColor: lightColors.textSecondary,
  },
  resyncButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.surface,
  },
});

export default OrderCard;
