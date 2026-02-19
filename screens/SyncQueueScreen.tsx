import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { formatMoney } from '../utils/money';
import { useSyncQueue, SyncQueueOrder } from '../hooks/useSyncQueue';
import { useCurrency } from '../hooks/useCurrency';

const SyncQueueScreen: React.FC = () => {
  const currency = useCurrency();
  const { orders, totalCount, failedCount, isLoading, isProcessing, retryOrder, retryAll, discardOrder, refresh } = useSyncQueue();

  const handleRetryOrder = useCallback(
    (orderId: string) => {
      retryOrder(orderId).then(success => {
        if (success) {
          Alert.alert('Success', 'Order synced successfully.');
        } else {
          Alert.alert('Failed', 'Order sync failed. It will be retried automatically.');
        }
      });
    },
    [retryOrder]
  );

  const handleRetryAll = useCallback(() => {
    Alert.alert('Retry All', `Retry syncing ${totalCount} order(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Retry All',
        onPress: () => {
          retryAll().then(result => {
            Alert.alert('Sync Complete', `Synced: ${result.synced}, Failed: ${result.failed}`);
          });
        },
      },
    ]);
  }, [totalCount, retryAll]);

  const handleDiscardOrder = useCallback(
    (orderId: string) => {
      Alert.alert(
        'Discard Order',
        'This order will be marked as cancelled and will not be synced to the platform. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              discardOrder(orderId).then(success => {
                if (!success) {
                  Alert.alert('Error', 'Failed to discard order.');
                }
              });
            },
          },
        ]
      );
    },
    [discardOrder]
  );

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced':
        return lightColors.success;
      case 'failed':
        return lightColors.error;
      case 'pending':
      default:
        return lightColors.warning;
    }
  };

  const getSyncStatusLabel = (status: string) => {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'failed':
        return 'Failed';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderOrderItem = ({ item }: { item: SyncQueueOrder }) => {
    const statusColor = getSyncStatusColor(item.syncStatus);
    const isFailed = item.syncStatus === 'failed';

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderIdRow}>
            <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{getSyncStatusLabel(item.syncStatus)}</Text>
            </View>
          </View>
          <Text style={styles.orderTotal}>{formatMoney(item.total, currency.code)}</Text>
        </View>

        <View style={styles.orderMeta}>
          {item.cashierName && <Text style={styles.metaText}>Cashier: {item.cashierName}</Text>}
          <Text style={styles.metaText}>Created: {formatTime(item.createdAt)}</Text>
        </View>

        {item.syncError && item.syncError !== '' && (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={14} color={lightColors.error} />
            <Text style={styles.errorText} numberOfLines={2}>
              {item.syncError}
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.retryButton]}
            onPress={() => handleRetryOrder(item.id)}
            disabled={isProcessing}
          >
            <MaterialIcons name="refresh" size={16} color={lightColors.textOnPrimary} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>

          {isFailed && (
            <TouchableOpacity
              style={[styles.actionButton, styles.discardButton]}
              onPress={() => handleDiscardOrder(item.id)}
              disabled={isProcessing}
            >
              <MaterialIcons name="delete-outline" size={16} color={lightColors.error} />
              <Text style={styles.discardButtonText}>Discard</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={lightColors.primary} />
        <Text style={styles.loadingText}>Loading sync queue…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalCount}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: lightColors.warning }]}>{totalCount - failedCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: lightColors.error }]}>{failedCount}</Text>
          <Text style={styles.summaryLabel}>Failed</Text>
        </View>
        {totalCount > 0 && (
          <TouchableOpacity style={styles.retryAllButton} onPress={handleRetryAll} disabled={isProcessing}>
            {isProcessing ? (
              <ActivityIndicator size="small" color={lightColors.textOnPrimary} />
            ) : (
              <>
                <MaterialIcons name="sync" size={18} color={lightColors.textOnPrimary} />
                <Text style={styles.retryAllText}>Retry All</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Order list */}
      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        renderItem={renderOrderItem}
        contentContainerStyle={orders.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="check-circle" size={64} color={lightColors.success} />
            <Text style={styles.emptyTitle}>All synced!</Text>
            <Text style={styles.emptyDescription}>All orders have been successfully synced to the platform.</Text>
          </View>
        }
      />
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
    backgroundColor: lightColors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    ...elevation.low,
  },
  summaryItem: {
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  summaryValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  retryAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginLeft: 'auto',
  },
  retryAllText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
  },
  orderCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.low,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderId: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginRight: spacing.sm,
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
  },
  orderTotal: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  orderMeta: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: lightColors.error + '10',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.error,
    marginLeft: spacing.xs,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  retryButton: {
    backgroundColor: lightColors.primary,
  },
  retryButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
    fontSize: typography.fontSize.sm,
    marginLeft: 4,
  },
  discardButton: {
    backgroundColor: lightColors.error + '15',
    borderWidth: 1,
    borderColor: lightColors.error + '30',
  },
  discardButtonText: {
    color: lightColors.error,
    fontWeight: '600',
    fontSize: typography.fontSize.sm,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginTop: spacing.md,
  },
  emptyDescription: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default SyncQueueScreen;
