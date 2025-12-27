import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBasketContext } from '../contexts/BasketProvider';
import type { MoreStackScreenProps } from '../navigation/types';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { LocalOrder } from '../services/basket/BasketServiceInterface';

interface DailyOrdersScreenProps extends MoreStackScreenProps<'DailyOrders'> {}

const DailyOrdersScreen: React.FC<DailyOrdersScreenProps> = ({ navigation }) => {
  const {
    getLocalOrders,
    syncOrderToPlatform,
    getSyncQueueStatus,
    unsyncedOrdersCount,
  } = useBasketContext();

  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      // Get today's orders (created today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();

      const allOrders = await getLocalOrders();
      const todayOrders = allOrders.filter(order => order.createdAt.getTime() >= todayStart);

      // Sort by creation time (newest first)
      todayOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setOrders(todayOrders);
    } catch (error) {
      console.error('Failed to load orders:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [getLocalOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleResyncOrder = useCallback(async (orderId: string) => {
    try {
      setSyncingOrderId(orderId);
      const result = await syncOrderToPlatform(orderId);

      if (result.success) {
        Alert.alert('Success', 'Order synced successfully!');
        await loadOrders(); // Refresh the list
      } else {
        Alert.alert('Sync Failed', result.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Failed to resync order:', error);
      Alert.alert('Error', 'Failed to resync order');
    } finally {
      setSyncingOrderId(null);
    }
  }, [syncOrderToPlatform, loadOrders]);

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

  const renderOrderItem = ({ item: order }: { item: LocalOrder }) => {
    const isSyncing = syncingOrderId === order.id;

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>Order #{order.id.slice(-8)}</Text>
            <Text style={styles.orderTime}>
              {order.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(order) + '20' }]}>
            <Text style={[styles.statusText, { color: getOrderStatusColor(order) }]}>
              {getOrderStatusText(order)}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <Text style={styles.customerInfo}>
            {order.customerName || 'Guest'} • ${order.total.toFixed(2)}
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

        {order.syncStatus !== 'synced' && (
          <TouchableOpacity
            style={[styles.resyncButton, isSyncing && styles.resyncButtonDisabled]}
            onPress={() => handleResyncOrder(order.id)}
            disabled={isSyncing}
          >
            <MaterialIcons
              name={isSyncing ? 'sync' : 'sync-problem'}
              size={16}
              color={lightColors.surface}
            />
            <Text style={styles.resyncButtonText}>
              {isSyncing ? 'Syncing...' : 'Resync'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="receipt-long" size={64} color={lightColors.textSecondary} />
      <Text style={styles.emptyTitle}>No Orders Today</Text>
      <Text style={styles.emptySubtitle}>
        Orders from today will appear here
      </Text>
    </View>
  );

  const syncQueueStatus = getSyncQueueStatus();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Orders</Text>
        <Text style={styles.subtitle}>
          {orders.length} order{orders.length !== 1 ? 's' : ''} • {unsyncedOrdersCount} pending sync
        </Text>
      </View>

      {syncQueueStatus.length > 0 && (
        <View style={styles.queueStatus}>
          <MaterialIcons name="sync" size={16} color={lightColors.primary} />
          <Text style={styles.queueText}>
            {syncQueueStatus.length} request{syncQueueStatus.length !== 1 ? 's' : ''} in queue
          </Text>
        </View>
      )}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderItem}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={orders.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  queueStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: lightColors.primary + '10',
    borderRadius: borderRadius.md,
  },
  queueText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '500',
  },
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
  emptyList: {
    flex: 1,
  },
});

export default DailyOrdersScreen;
