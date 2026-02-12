import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBasketContext } from '../contexts/BasketProvider';
import { useAuthContext } from '../contexts/AuthProvider';
import { useDailyReport, DailyReportData } from '../hooks/useDailyReport';
import type { MoreStackScreenProps } from '../navigation/types';
import { lightColors, spacing, typography, borderRadius } from '../utils/theme';
import { LocalOrder } from '../services/basket/BasketServiceInterface';
import OrderCard from './daily-orders/OrderCard';
import ShiftModal from './daily-orders/ShiftModal';
import ReportModal from './daily-orders/ReportModal';

interface DailyOrdersScreenProps extends MoreStackScreenProps<'DailyOrders'> {}

const DailyOrdersScreen: React.FC<DailyOrdersScreenProps> = ({ navigation }) => {
  const { getLocalOrders, syncOrderToPlatform, getSyncQueueStatus, unsyncedOrdersCount } = useBasketContext();

  const { user } = useAuthContext();
  const { currentShift, openShift, closeShift, generateReport, getReportLines, getReceiptLines } = useDailyReport();

  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);

  // Shift management state
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close'>('open');
  const [cashAmount, setCashAmount] = useState('');
  const [isProcessingShift, setIsProcessingShift] = useState(false);

  // Report state
  const [currentReport, setCurrentReport] = useState<DailyReportData | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

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

  const handleResyncOrder = useCallback(
    async (orderId: string) => {
      try {
        setSyncingOrderId(orderId);
        const result = await syncOrderToPlatform(orderId);

        if (result.success) {
          Alert.alert('Success', 'Order synced successfully!');
          await loadOrders();
        } else {
          Alert.alert('Sync Failed', result.error || 'Unknown error occurred');
        }
      } catch (error) {
        console.error('Failed to resync order:', error);
        Alert.alert('Error', 'Failed to resync order');
      } finally {
        setSyncingOrderId(null);
      }
    },
    [syncOrderToPlatform, loadOrders]
  );

  const handleOpenShift = useCallback(() => {
    setShiftModalMode('open');
    setCashAmount('');
    setShowShiftModal(true);
  }, []);

  const handleCloseShift = useCallback(() => {
    setShiftModalMode('close');
    setCashAmount('');
    setShowShiftModal(true);
  }, []);

  const handleShiftSubmit = useCallback(async () => {
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid cash amount.');
      return;
    }

    setIsProcessingShift(true);
    try {
      if (shiftModalMode === 'open') {
        await openShift(user?.username || 'Unknown', user?.id || 'unknown', amount);
        Alert.alert('Shift Opened', `Shift started with $${amount.toFixed(2)} opening cash.`);
      } else {
        const closedShift = await closeShift(amount);
        const report = await generateReport(orders, closedShift);
        setCurrentReport(report);
        setShowReportModal(true);
        Alert.alert('Shift Closed', 'Daily report generated. You can now print it.');
      }
      setShowShiftModal(false);
      setCashAmount('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to process shift');
    } finally {
      setIsProcessingShift(false);
    }
  }, [cashAmount, shiftModalMode, openShift, closeShift, generateReport, orders, user]);

  const handleGenerateReport = useCallback(async () => {
    try {
      const report = await generateReport(orders);
      setCurrentReport(report);
      setShowReportModal(true);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate report');
    }
  }, [generateReport, orders]);

  const handlePrintReport = useCallback(() => {
    if (!currentReport) return;
    const lines = getReportLines(currentReport);
    console.log('=== DAILY REPORT ===');
    lines.forEach(line => console.log(line));
    Alert.alert('Print', 'Report sent to printer. Check console for preview.');
  }, [currentReport, getReportLines]);

  const handlePrintReceipt = useCallback(
    (order: LocalOrder) => {
      const lines = getReceiptLines(order);
      console.log('=== RECEIPT ===');
      lines.forEach(line => console.log(line));
      Alert.alert('Print', 'Receipt sent to printer. Check console for preview.');
    },
    [getReceiptLines]
  );

  const renderOrderItem = ({ item: order }: { item: LocalOrder }) => (
    <OrderCard
      order={order}
      isSyncing={syncingOrderId === order.id}
      onResync={handleResyncOrder}
      onPrintReceipt={handlePrintReceipt}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="receipt-long" size={64} color={lightColors.textSecondary} />
      <Text style={styles.emptyTitle}>No Orders Today</Text>
      <Text style={styles.emptySubtitle}>Orders from today will appear here</Text>
    </View>
  );

  const syncQueueStatus = getSyncQueueStatus();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Daily Orders</Text>
            <Text style={styles.subtitle}>
              {orders.length} order{orders.length !== 1 ? 's' : ''} • {unsyncedOrdersCount} pending sync
            </Text>
          </View>
          {currentShift && (
            <View style={styles.shiftBadge}>
              <MaterialIcons name="access-time" size={14} color={lightColors.success} />
              <Text style={styles.shiftBadgeText}>Shift Open</Text>
            </View>
          )}
        </View>

        <View style={styles.actionBar}>
          {!currentShift ? (
            <TouchableOpacity style={styles.shiftButton} onPress={handleOpenShift}>
              <MaterialIcons name="play-arrow" size={18} color={lightColors.surface} />
              <Text style={styles.shiftButtonText}>Open Shift</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.shiftButton, styles.closeShiftButton]} onPress={handleCloseShift}>
              <MaterialIcons name="stop" size={18} color={lightColors.surface} />
              <Text style={styles.shiftButtonText}>Close Shift</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.reportButton} onPress={handleGenerateReport}>
            <MaterialIcons name="assessment" size={18} color={lightColors.primary} />
            <Text style={styles.reportButtonText}>View Report</Text>
          </TouchableOpacity>
        </View>
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
        keyExtractor={item => item.id}
        renderItem={renderOrderItem}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={orders.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
      />

      <ShiftModal
        visible={showShiftModal}
        mode={shiftModalMode}
        cashAmount={cashAmount}
        isProcessing={isProcessingShift}
        onCashAmountChange={setCashAmount}
        onSubmit={handleShiftSubmit}
        onClose={() => setShowShiftModal(false)}
      />

      <ReportModal
        visible={showReportModal}
        report={currentReport}
        onPrint={handlePrintReport}
        onClose={() => setShowReportModal(false)}
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
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
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  shiftBadgeText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: lightColors.success,
  },
  actionBar: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shiftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  closeShiftButton: {
    backgroundColor: lightColors.warning,
  },
  shiftButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.surface,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  reportButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.primary,
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
