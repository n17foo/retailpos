import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import { useDailyReport, DailyReportData } from '../hooks/useDailyReport';
import type { MoreStackScreenProps } from '../../../app/navigation/types';
import { lightColors, spacing, typography, borderRadius } from '../../../shared/utils/theme';
import { LocalOrder } from '../../basket/services/BasketServiceInterface';
import { formatMoney } from '../../../shared/utils/money';
import OrderCard from '../components/OrderCard';
import ShiftModal from '../components/ShiftModal';
import ReportModal from '../components/ReportModal';
import ReceiptModal from '../components/ReceiptModal';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { useLogger } from '../../../shared/hooks/useLogger';
import { PrinterServiceFactory } from '../../hardware/services/printer/PrinterServiceFactory';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { useCheckoutContext } from '../../checkout/contexts/CheckoutProvider';

interface OrderHistoryScreenProps extends MoreStackScreenProps<'OrderHistory'> {}

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const OrderHistoryScreen: React.FC<OrderHistoryScreenProps> = () => {
  const { getSyncQueueStatus, unsyncedOrdersCount } = useCheckoutContext();
  const { user } = useAuthContext();
  const navigation = useNavigation<MoreStackScreenProps<'OrderHistory'>['navigation']>();
  const { currentShift, openShift, closeShift, generateReport, getReportLines } = useDailyReport();
  const logger = useLogger('OrderHistoryScreen');
  const currency = useCurrency();

  const {
    orders,
    refreshing,
    dayOffset,
    isToday,
    isCashier,
    isAdmin,
    syncingOrderId,
    onRefresh,
    handlePreviousDay,
    handleNextDay,
    handleResyncOrder,
    handleDeleteOrder,
    getDayStart: getOffset,
  } = useOrderHistory();

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

  const handlePrintReceipt = useCallback((order: LocalOrder) => {
    setSelectedOrder(order);
    setShowReceiptModal(true);
  }, []);

  const handleExchange = useCallback(
    (orderId: string) => {
      navigation.navigate('Exchange', { orderId });
    },
    [navigation]
  );

  const handlePrintReceiptConfirm = useCallback(async () => {
    if (!selectedOrder) return;
    const printerService = PrinterServiceFactory.getInstance();
    if (!printerService.isConnectedToPrinter()) {
      Alert.alert('No Printer', 'No printer connected. Please connect a printer in Settings → Printer.');
      return;
    }
    try {
      const receiptData = {
        orderId: selectedOrder.id.slice(-8),
        items: selectedOrder.items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })),
        subtotal: selectedOrder.subtotal,
        tax: selectedOrder.tax,
        total: selectedOrder.total,
        paymentMethod: selectedOrder.paymentMethod ?? 'Unknown',
        paymentLines: selectedOrder.payments?.map(p => ({
          method: p.method,
          amount: p.amount,
          cardBrand: p.cardBrand,
          last4: p.last4,
          transactionId: p.transactionId,
        })),
        date: selectedOrder.createdAt,
        cashierName: selectedOrder.cashierName ?? 'Unknown',
        customerName: selectedOrder.customerName,
        currencySymbol: currency.symbol,
      };
      const success = await printerService.printReceipt(receiptData);
      if (!success) Alert.alert('Print Failed', 'Could not print the receipt.');
    } catch (err) {
      logger.error({ message: 'Failed to print receipt' }, err instanceof Error ? err : new Error(String(err)));
      Alert.alert('Print Error', err instanceof Error ? err.message : 'Failed to print receipt.');
    }
  }, [selectedOrder, currency.symbol, logger]);

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
  }, [cashAmount, shiftModalMode, openShift, closeShift, generateReport, orders, user, currency.code]);

  const handleGenerateReport = useCallback(async () => {
    try {
      const report = await generateReport(orders);
      setCurrentReport(report);
      setShowReportModal(true);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate report');
    }
  }, [generateReport, orders]);

  const handlePrintReport = useCallback(async () => {
    if (!currentReport) return;
    const printerService = PrinterServiceFactory.getInstance();
    if (!printerService.isConnectedToPrinter()) {
      Alert.alert('No Printer', 'No printer connected. Please connect a printer in Settings → Printer.');
      return;
    }
    try {
      const lines = getReportLines(currentReport);
      // Build a minimal ReceiptData from the report lines as plain text
      const receiptData = {
        orderId: `REPORT-${currentReport.date.toISOString().slice(0, 10)}`,
        items: lines.map(line => ({ name: line, quantity: 1, price: 0 })),
        subtotal: currentReport.summary.netSales,
        tax: currentReport.summary.totalTax,
        total: currentReport.summary.totalSales,
        paymentMethod: 'Report',
        date: currentReport.date,
        cashierName: currentReport.shift.cashierName,
        currencySymbol: currency.symbol,
      };
      const success = await printerService.printReceipt(receiptData);
      if (!success) Alert.alert('Print Failed', 'Could not print the report.');
    } catch (err) {
      logger.error({ message: 'Failed to print report' }, err instanceof Error ? err : new Error(String(err)));
      Alert.alert('Print Error', err instanceof Error ? err.message : 'Failed to print report.');
    }
  }, [currentReport, getReportLines, currency.symbol, logger]);

  // ============ Render ============

  const renderOrderItem = ({ item: order }: { item: LocalOrder }) => (
    <View>
      <OrderCard
        order={order}
        isSyncing={syncingOrderId === order.id}
        onResync={handleResyncOrder}
        onPrintReceipt={handlePrintReceipt}
        onExchange={handleExchange}
      />
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
        {isCashier ? 'Your orders for today will appear here' : `No orders for ${formatDate(getOffset(dayOffset))}`}
      </Text>
    </View>
  );

  const [syncQueueStatus, setSyncQueueStatus] = React.useState<{ pending: number; failed: number }>({ pending: 0, failed: 0 });

  React.useEffect(() => {
    getSyncQueueStatus().then(setSyncQueueStatus);
  }, [getSyncQueueStatus]);

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
            <Text style={styles.dateNavText}>{isToday ? 'Today' : formatDate(getOffset(dayOffset))}</Text>
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

      {(syncQueueStatus.pending > 0 || syncQueueStatus.failed > 0) && (
        <View style={styles.queueStatus}>
          <MaterialIcons name="sync" size={16} color={lightColors.primary} />
          <Text style={styles.queueText}>
            {syncQueueStatus.pending + syncQueueStatus.failed} request{syncQueueStatus.pending + syncQueueStatus.failed !== 1 ? 's' : ''} in
            queue
          </Text>
        </View>
      )}

      <FlashList
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
