import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBasketContext } from '../contexts/BasketProvider';
import { useAuthContext } from '../contexts/AuthProvider';
import { useDailyReport, DailyReportData } from '../hooks/useDailyReport';
import type { MoreStackScreenProps } from '../navigation/types';
import { lightColors, spacing, typography, borderRadius } from '../utils/theme';
import { LocalOrder } from '../services/basket/BasketServiceInterface';
import { orderRepository } from '../repositories/OrderRepository';
import { formatMoney } from '../utils/money';
import OrderCard from './order-history/OrderCard';
import ShiftModal from './order-history/ShiftModal';
import ReportModal from './order-history/ReportModal';
import ReceiptModal from './order-history/ReceiptModal';
import { useCurrency } from '../hooks/useCurrency';

interface OrderHistoryScreenProps extends MoreStackScreenProps<'OrderHistory'> {}

/** Get start-of-day timestamp for a given date offset (0 = today, -1 = yesterday, etc.) */
const getDayStart = (daysOffset: number = 0): number => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const getDayEnd = (daysOffset: number = 0): number => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const OrderHistoryScreen: React.FC<OrderHistoryScreenProps> = ({ navigation }) => {
  const { getLocalOrders, syncOrderToPlatform, getSyncQueueStatus, unsyncedOrdersCount } = useBasketContext();
  const { user } = useAuthContext();
  const { currentShift, openShift, closeShift, generateReport, getReportLines, getReceiptLines } = useDailyReport();

  const currency = useCurrency();
  const userRole = user?.role || 'cashier';
  const isAdmin = userRole === 'admin';
  const isCashier = userRole === 'cashier';

  // Orders state
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);

  // Date navigation (admin/manager can browse past days, cashier locked to today)
  const [dayOffset, setDayOffset] = useState(0);

  // Shift management state
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close'>('open');
  const [cashAmount, setCashAmount] = useState('');
  const [isProcessingShift, setIsProcessingShift] = useState(false);

  // Report state
  const [currentReport, setCurrentReport] = useState<DailyReportData | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Receipt preview state
  const [selectedOrder, setSelectedOrder] = useState<LocalOrder | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const fromTs = getDayStart(dayOffset);
      const toTs = getDayEnd(dayOffset);

      // Cashiers only see their own orders
      const cashierFilter = isCashier ? user?.id : undefined;
      const rows = await orderRepository.findByDateRange(fromTs, toTs, cashierFilter);

      // Convert rows to LocalOrder format using getLocalOrders as reference
      const allOrders = await getLocalOrders();
      const rowIds = new Set(rows.map(r => r.id));
      const filtered = allOrders.filter(o => rowIds.has(o.id));

      // Sort newest first
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setOrders(filtered);
    } catch (error) {
      console.error('Failed to load orders:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [dayOffset, isCashier, user?.id, getLocalOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // ============ Order Actions ============

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

  const handleDeleteOrder = useCallback(
    async (orderId: string) => {
      Alert.alert('Delete Order', 'Are you sure you want to delete this order? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await orderRepository.delete(orderId);
              await loadOrders();
              Alert.alert('Deleted', 'Order removed successfully');
            } catch (error) {
              console.error('Failed to delete order:', error);
              Alert.alert('Error', 'Failed to delete order');
            }
          },
        },
      ]);
    },
    [loadOrders]
  );

  const handlePrintReceipt = useCallback((order: LocalOrder) => {
    setSelectedOrder(order);
    setShowReceiptModal(true);
  }, []);

  const handlePrintReceiptConfirm = useCallback(() => {
    if (!selectedOrder) return;
    const lines = getReceiptLines(selectedOrder);
    console.log('=== RECEIPT ===');
    lines.forEach(line => console.log(line));
    Alert.alert('Print', 'Receipt sent to printer. Check console for preview.');
  }, [selectedOrder, getReceiptLines]);

  // ============ Shift Actions ============

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
        Alert.alert('Shift Opened', `Shift started with ${formatMoney(amount, currency.code)} opening cash.`);
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

  // ============ Date Navigation ============

  const handlePreviousDay = useCallback(() => {
    if (!isCashier) setDayOffset(prev => prev - 1);
  }, [isCashier]);

  const handleNextDay = useCallback(() => {
    if (!isCashier && dayOffset < 0) setDayOffset(prev => prev + 1);
  }, [isCashier, dayOffset]);

  // ============ Render ============

  const renderOrderItem = ({ item: order }: { item: LocalOrder }) => (
    <View>
      <OrderCard order={order} isSyncing={syncingOrderId === order.id} onResync={handleResyncOrder} onPrintReceipt={handlePrintReceipt} />
      {isAdmin && (
        <TouchableOpacity style={styles.deleteOrderButton} onPress={() => handleDeleteOrder(order.id)}>
          <MaterialIcons name="delete-outline" size={16} color={lightColors.error} />
          <Text style={styles.deleteOrderText}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="receipt-long" size={64} color={lightColors.textSecondary} />
      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptySubtitle}>
        {isCashier ? 'Your orders for today will appear here' : `No orders for ${formatDate(getDayStart(dayOffset))}`}
      </Text>
    </View>
  );

  const syncQueueStatus = getSyncQueueStatus();
  const isToday = dayOffset === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Order History</Text>
            <Text style={styles.subtitle}>
              {orders.length} order{orders.length !== 1 ? 's' : ''}{' '}
              {unsyncedOrdersCount > 0 ? `\u2022 ${unsyncedOrdersCount} pending sync` : ''}
            </Text>
          </View>
          {currentShift && (
            <View style={styles.shiftBadge}>
              <MaterialIcons name="access-time" size={14} color={lightColors.success} />
              <Text style={styles.shiftBadgeText}>Shift Open</Text>
            </View>
          )}
        </View>

        {/* Date navigation (admin/manager only) */}
        {!isCashier && (
          <View style={styles.dateNav}>
            <TouchableOpacity style={styles.dateNavButton} onPress={handlePreviousDay}>
              <MaterialIcons name="chevron-left" size={24} color={lightColors.primary} />
            </TouchableOpacity>
            <Text style={styles.dateNavText}>{isToday ? 'Today' : formatDate(getDayStart(dayOffset))}</Text>
            <TouchableOpacity
              style={[styles.dateNavButton, isToday && styles.dateNavButtonDisabled]}
              onPress={handleNextDay}
              disabled={isToday}
            >
              <MaterialIcons name="chevron-right" size={24} color={isToday ? lightColors.textDisabled : lightColors.primary} />
            </TouchableOpacity>
          </View>
        )}

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

      <ReportModal visible={showReportModal} report={currentReport} onPrint={handlePrintReport} onClose={() => setShowReportModal(false)} />

      <ReceiptModal
        visible={showReceiptModal}
        order={selectedOrder}
        onPrint={handlePrintReceiptConfirm}
        onClose={() => setShowReceiptModal(false)}
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
  // Date navigation
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
  },
  dateNavButton: {
    padding: spacing.xs,
  },
  dateNavButtonDisabled: {
    opacity: 0.4,
  },
  dateNavText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    paddingHorizontal: spacing.md,
    minWidth: 140,
    textAlign: 'center',
  },
  // Actions
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
  // Queue status
  queueStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: lightColors.primary + '10',
    borderRadius: borderRadius.md,
  },
  queueText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '500',
  },
  // Delete button (admin only)
  deleteOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
    paddingVertical: spacing.xs,
    backgroundColor: lightColors.error + '10',
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
  },
  deleteOrderText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.error,
  },
  // Empty state
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

export default OrderHistoryScreen;
