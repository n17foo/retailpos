import React, { useState, useCallback } from 'react';
import { View, Text, Alert, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import { useDailyReport, DailyReportData } from '../hooks/useDailyReport';
import type { MoreStackScreenProps } from '../../../app/navigation/types';
import { lightColors } from '../../../shared/utils/theme';
import { LocalOrder } from '../../basket/services/BasketServiceInterface';
import { formatMoney } from '../../../shared/utils/money';
import ShiftModal from '../components/ShiftModal';
import ReportModal from '../components/ReportModal';
import ReceiptModal from '../components/ReceiptModal';
import { OrderHistoryHeader } from '../components/OrderHistoryHeader';
import { SyncQueueBanner } from '../components/SyncQueueBanner';
import { OrderHistoryListItem } from '../components/OrderHistoryListItem';
import { orderHistoryStyles as styles } from '../components/orderHistoryStyles';
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
    <OrderHistoryListItem
      order={order}
      isSyncing={syncingOrderId === order.id}
      isAdmin={isAdmin}
      onResync={handleResyncOrder}
      onDelete={handleDeleteOrder}
      onPrintReceipt={handlePrintReceipt}
      onExchange={handleExchange}
    />
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
      <OrderHistoryHeader
        orderCount={orders.length}
        unsyncedOrdersCount={unsyncedOrdersCount}
        shiftOpen={!!currentShift}
        isCashier={isCashier}
        isToday={isToday}
        dateLabel={isToday ? 'Today' : formatDate(getOffset(dayOffset))}
        onPreviousDay={handlePreviousDay}
        onNextDay={handleNextDay}
        onOpenShift={handleOpenShift}
        onCloseShift={handleCloseShift}
        onViewReport={handleGenerateReport}
      />

      <SyncQueueBanner pending={syncQueueStatus.pending} failed={syncQueueStatus.failed} />

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

export default OrderHistoryScreen;
