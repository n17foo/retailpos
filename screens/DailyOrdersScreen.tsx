import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBasketContext } from '../contexts/BasketProvider';
import { useAuthContext } from '../contexts/AuthProvider';
import { useDailyReport, ShiftData, DailyReportData } from '../hooks/useDailyReport';
import type { MoreStackScreenProps } from '../navigation/types';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { LocalOrder } from '../services/basket/BasketServiceInterface';

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
            <Text style={styles.orderTime}>{order.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(order) + '20' }]}>
            <Text style={[styles.statusText, { color: getOrderStatusColor(order) }]}>{getOrderStatusText(order)}</Text>
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

        <View style={styles.orderActions}>
          <TouchableOpacity style={styles.printButton} onPress={() => handlePrintReceipt(order)}>
            <MaterialIcons name="print" size={16} color={lightColors.primary} />
            <Text style={styles.printButtonText}>Print</Text>
          </TouchableOpacity>

          {order.syncStatus !== 'synced' && (
            <TouchableOpacity
              style={[styles.resyncButton, isSyncing && styles.resyncButtonDisabled]}
              onPress={() => handleResyncOrder(order.id)}
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

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="receipt-long" size={64} color={lightColors.textSecondary} />
      <Text style={styles.emptyTitle}>No Orders Today</Text>
      <Text style={styles.emptySubtitle}>Orders from today will appear here</Text>
    </View>
  );

  const syncQueueStatus = getSyncQueueStatus();

  const renderShiftModal = () => (
    <Modal visible={showShiftModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{shiftModalMode === 'open' ? 'Open Shift' : 'Close Shift'}</Text>
          <Text style={styles.modalDescription}>
            {shiftModalMode === 'open'
              ? 'Enter the opening cash amount in the drawer.'
              : 'Count and enter the closing cash amount in the drawer.'}
          </Text>

          <Text style={styles.inputLabel}>Cash Amount ($)</Text>
          <TextInput
            style={styles.modalInput}
            value={cashAmount}
            onChangeText={setCashAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            autoFocus
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowShiftModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSubmitButton, isProcessingShift && styles.buttonDisabled]}
              onPress={handleShiftSubmit}
              disabled={isProcessingShift}
            >
              <Text style={styles.modalSubmitText}>
                {isProcessingShift ? 'Processing...' : shiftModalMode === 'open' ? 'Open Shift' : 'Close Shift'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderReportModal = () => (
    <Modal visible={showReportModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.reportModalContent}>
          <Text style={styles.modalTitle}>Daily Sales Report</Text>

          {currentReport && (
            <View style={styles.reportSummary}>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Total Orders:</Text>
                <Text style={styles.reportValue}>{currentReport.summary.totalOrders}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Items Sold:</Text>
                <Text style={styles.reportValue}>{currentReport.summary.itemsSold}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Gross Sales:</Text>
                <Text style={styles.reportValue}>${currentReport.summary.totalSales.toFixed(2)}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Tax Collected:</Text>
                <Text style={styles.reportValue}>${currentReport.summary.totalTax.toFixed(2)}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Net Sales:</Text>
                <Text style={[styles.reportValue, styles.reportTotal]}>${currentReport.summary.netSales.toFixed(2)}</Text>
              </View>
            </View>
          )}

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowReportModal(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.printReportButton} onPress={handlePrintReport}>
              <MaterialIcons name="print" size={18} color={lightColors.surface} />
              <Text style={styles.printReportText}>Print Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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

      {renderShiftModal()}
      {renderReportModal()}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 400,
  },
  reportModalContent: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 450,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: lightColors.background,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.divider,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.primary,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.surface,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  reportSummary: {
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  reportLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  reportValue: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  reportTotal: {
    fontSize: typography.fontSize.lg,
    color: lightColors.success,
  },
  printReportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.success,
  },
  printReportText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.surface,
  },
});

export default DailyOrdersScreen;
