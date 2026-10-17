/**
 * SaleScreen — the full-screen home of the POS
 * (docs/specs/system/sales-screen-fast-path-ux.md).
 *
 *  - Merged top bar: menu, register/cashier, omnibar, sync badge, drawer
 *    warning, sale-state chip. No bottom tab bar.
 *  - Persistent category navigation under the top bar.
 *  - Omnibar search replaces the product grid with results; Enter adds the
 *    single/exact match.
 *  - Split shell (tablet/desktop/landscape): permanent basket column.
 *    Stacked shell (phone): sticky BasketBar opens the basket as a sheet.
 *  - Hardware scans resolve in place (ScanNoticeBar) — the shared scanner
 *    stays connected while sheets and the checkout modal are open.
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { lightColors, hitTarget } from '../utils/theme';
import { SaleProvider, useSale } from '../contexts/SaleProvider';
import { useAuthContext } from '../contexts/AuthProvider';
import { useCheckoutContext } from '../contexts/CheckoutProvider';
import { useInterruptionRecovery } from '../hooks/useInterruptionRecovery';
import { useLogger } from '../hooks/useLogger';
import { TopBar } from './sale/TopBar';
import { MainMenu } from './sale/MainMenu';
import { CategoryBar } from './sale/CategoryBar';
import { ProductGrid } from './sale/ProductGrid';
import { SearchResults } from './sale/SearchResults';
import { BasketPanel } from './sale/BasketPanel';
import { BasketBar } from './sale/BasketBar';
import { ScanNoticeBar } from './sale/ScanNoticeBar';
import { BottomSheet } from '../components/BottomSheet';
import { HidCaptureField } from '../components/HidCaptureField';
import { CameraScanOverlay } from '../components/CameraScanOverlay';
import { CheckoutModal } from '../components/CheckoutModal';
import { InterruptionBanner } from '../components/InterruptionBanner';
import { instoreApiConfig } from '../services/instoreapi/InstoreApiConfig';
import { PrinterServiceFactory } from '../services/printer/PrinterServiceFactory';
import { notificationService } from '../services/notifications/NotificationService';
import { posConfig } from '../services/config/POSConfigService';
import { useBasketActions } from '../contexts/BasketActionsProvider';
import type { MainTabParamList, MoreStackParamList } from '../navigation/types';

interface SaleScreenProps {
  username?: string;
  /** Locks the register (returns to the PIN screen) */
  onLock?: () => void;
  onLogout?: () => void;
}

const SaleScreenContent: React.FC<SaleScreenProps> = ({ username = 'User', onLock, onLogout }) => {
  const logger = useLogger('SaleScreen');
  const { user } = useAuthContext();
  const { getLocalOrders } = useCheckoutContext();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const sale = useSale();
  const { layout, inputMode, checkout } = sale;
  const { setSaleMode } = useBasketActions();

  // Fulfilment modes — the top-bar chip stays hidden unless more than one is enabled (spec 6.36)
  const saleModes = posConfig.values.saleModes ?? ['counter'];
  const activeSaleMode = sale.basket?.saleMode ?? saleModes[0];
  const cycleSaleMode = () => {
    const idx = Math.max(0, saleModes.indexOf(activeSaleMode));
    void setSaleMode(saleModes[(idx + 1) % saleModes.length]);
  };

  const [menuVisible, setMenuVisible] = useState(false);

  const {
    interruptionState,
    resumeDraftSale,
    resumeCheckout,
    recoverPayment,
    clearAndDismiss,
    cancelAndDismiss,
    retrySync,
    dismissBanner,
  } = useInterruptionRecovery();

  const goToMore = useCallback(
    (route: keyof MoreStackParamList) => {
      navigation.navigate('More', { screen: route } as never);
    },
    [navigation]
  );

  /** Reprint the most recently paid order's receipt (menu quick action) */
  const handleReprint = useCallback(async () => {
    try {
      const [paid, synced] = await Promise.all([getLocalOrders('paid'), getLocalOrders('synced')]);
      const last = [...paid, ...synced].sort(
        (a, b) => new Date(b.paidAt ?? b.updatedAt).getTime() - new Date(a.paidAt ?? a.updatedAt).getTime()
      )[0];
      if (!last) {
        notificationService.notify('Reprint receipt', 'No completed orders yet', 'info');
        return;
      }
      const printer = PrinterServiceFactory.getInstance();
      if (!printer.isConnectedToPrinter()) {
        notificationService.notify('Reprint receipt', 'No printer connected', 'warning');
        return;
      }
      await printer.printReceipt({
        orderId: last.id.slice(-8),
        items: last.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
        subtotal: last.subtotal,
        tax: last.tax,
        total: last.total,
        paymentMethod: last.paymentMethod ?? 'other',
        date: new Date(last.paidAt ?? last.updatedAt),
        cashierName: last.cashierName ?? 'Cashier',
        customerName: last.customerName,
        saleMode: last.saleMode,
      });
    } catch (error) {
      logger.error({ message: 'Reprint failed' }, error instanceof Error ? error : new Error(String(error)));
      notificationService.notify('Reprint receipt', 'Could not reprint the last receipt', 'warning');
    }
  }, [getLocalOrders, logger]);

  const getInterruptionActions = () => {
    switch (interruptionState.type) {
      case 'draft-sale':
        return [
          { label: 'Resume Sale', onPress: resumeDraftSale, variant: 'primary' as const },
          { label: 'Clear Basket', onPress: clearAndDismiss, variant: 'secondary' as const },
        ];
      case 'interrupted-checkout':
        return [
          {
            label: 'Resume Checkout',
            onPress: () => {
              resumeCheckout();
              void sale.checkout.handleStartCheckout('method');
            },
            variant: 'primary' as const,
          },
          { label: 'Cancel Order', onPress: cancelAndDismiss, variant: 'secondary' as const },
        ];
      case 'interrupted-payment':
        return [
          { label: 'Recover Payment', onPress: recoverPayment, variant: 'primary' as const },
          { label: 'Cancel Order', onPress: cancelAndDismiss, variant: 'secondary' as const },
        ];
      case 'unsynced':
        return [
          { label: 'Retry Sync', onPress: retrySync, variant: 'primary' as const },
          { label: 'Continue', onPress: dismissBanner, variant: 'secondary' as const },
        ];
      default:
        return [];
    }
  };

  const getInterruptionMessage = () => {
    switch (interruptionState.type) {
      case 'draft-sale':
        return `You have a draft sale in progress (${interruptionState.itemCount} items)`;
      case 'interrupted-checkout':
        return `Checkout was interrupted. Order #${interruptionState.orderId?.slice(-8)} · ${interruptionState.itemCount} items`;
      case 'interrupted-payment':
        return `Payment was interrupted. Order #${interruptionState.orderId?.slice(-8)} · Processing state`;
      case 'unsynced':
        return `${sale.unsyncedOrdersCount} ${sale.unsyncedOrdersCount === 1 ? 'order' : 'orders'} pending sync`;
      default:
        return '';
    }
  };

  const categoryTargetSize = inputMode === 'touch' ? hitTarget.touchMin : hitTarget.pointerMin;

  const catalogueArea = (
    <>
      <CategoryBar mode={layout.categoryMode} targetSize={categoryTargetSize} />
      {sale.scanNotice && <ScanNoticeBar notice={sale.scanNotice} />}
      {sale.isSearchActive ? (
        <SearchResults
          results={sale.searchProducts}
          isSearching={sale.isSearching}
          query={sale.searchQuery}
          onAdd={hit => void sale.addSearchProduct(hit)}
        />
      ) : (
        <ProductGrid
          products={sale.displayProducts}
          onAdd={(product, variantId) => void sale.addProduct(product, variantId)}
          basketItemsMap={sale.basketItemsMap}
          layout={layout}
          density={sale.tileDensity}
          isLoading={sale.isCatalogLoading}
          onLoadMore={sale.hasMore ? sale.loadMore : undefined}
        />
      )}
    </>
  );

  const basketPanel = (
    <BasketPanel
      platform={sale.currentPlatform ?? undefined}
      inputMode={inputMode}
      onTender={t => {
        sale.openTender(t);
        sale.closeBasketSheet();
      }}
    />
  );

  return (
    <View style={styles.container}>
      {/* Invisible HID capture field keeps scanner bursts out of other inputs (native) */}
      <HidCaptureField onScan={code => void sale.handleScan(code)} />

      <TopBar
        registerName={instoreApiConfig.current.registerName}
        cashierName={user?.username || username}
        saleState={sale.saleState}
        unsyncedCount={sale.unsyncedOrdersCount}
        isSyncing={sale.isSyncing}
        onSyncPress={() => void sale.syncAllPendingOrders()}
        isDrawerOpen={sale.isDrawerOpen}
        onMenuPress={() => setMenuVisible(true)}
        height={layout.topBarHeight}
        searchQuery={sale.searchQuery}
        onSearchChange={sale.setSearchQuery}
        onSearchSubmit={() => void sale.submitSearch()}
        onCameraPress={sale.openCamera}
        showCamera={!sale.isElectron}
        isSearching={sale.isSearching}
        inputMode={inputMode}
        collapseOmnibar={layout.layoutClass === 'phone-landscape'}
        saleModes={saleModes}
        saleMode={activeSaleMode}
        onCycleSaleMode={cycleSaleMode}
      />

      {interruptionState.type !== 'none' && (
        <InterruptionBanner
          type={interruptionState.type}
          message={getInterruptionMessage()}
          actions={getInterruptionActions()}
          onDismiss={dismissBanner}
        />
      )}

      {layout.shell === 'split' ? (
        <View style={styles.splitLayout}>
          <View style={styles.catalogueColumn}>{catalogueArea}</View>
          <View style={[styles.basketColumn, { width: layout.basketWidth }]}>{basketPanel}</View>
        </View>
      ) : (
        <View style={styles.stackedLayout}>
          <View style={styles.catalogueColumn}>{catalogueArea}</View>
          <BasketBar itemCount={sale.itemCount} total={sale.total} onPress={sale.openBasketSheet} />
          <BottomSheet visible={sale.isBasketSheetOpen} onClose={sale.closeBasketSheet} title="Basket">
            {basketPanel}
          </BottomSheet>
        </View>
      )}

      <MainMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        userRole={user?.role}
        onLock={() => onLock?.()}
        onLogout={() => onLogout?.()}
        onReprintReceipt={handleReprint}
        onShiftReport={() => goToMore('Reports')}
        unsyncedCount={sale.unsyncedOrdersCount}
        onSyncPress={() => void sale.syncAllPendingOrders()}
      />

      <CameraScanOverlay
        visible={sale.isCameraOpen}
        onClose={sale.closeCamera}
        onScanned={sale.handleBarCodeScanned}
        presentation={layout.shell === 'split' ? 'side' : 'full'}
      />

      <CheckoutModal
        visible={checkout.checkoutVisible}
        orderId={checkout.currentOrder?.id || ''}
        orderTotal={checkout.total}
        orderSubtotal={checkout.subtotal}
        orderTax={checkout.tax}
        itemCount={checkout.itemCount}
        onSelectPayment={selection => void checkout.handlePayment(selection)}
        onCancel={() => void checkout.handleCancelCheckout()}
        isProcessing={checkout.isProcessing || checkout.isDraftPending}
        terminalConnected={checkout.terminalConnected}
        paymentMode={checkout.paymentMode}
        activeProvider={checkout.activeProvider}
        splitMode={checkout.splitMode}
        paymentLines={checkout.paymentLines}
        onAddPaymentLine={line => void checkout.addPaymentLine(line)}
        onRemovePaymentLine={lineId => void checkout.removePaymentLine(lineId)}
        onCompleteSplit={() => void checkout.handleCompleteSplit()}
        splitCashTenderAmount={checkout.splitCashTenderAmount}
        onConfirmSplitCash={amount => void checkout.confirmSplitCashPayment(amount)}
        customerEmail={sale.basket?.customerEmail}
        loyaltyPoints={sale.loyalty.loyaltyBalance?.points || 0}
        storeCreditDollars={sale.loyalty.storeCreditDollars}
        initialTender={checkout.initialTender}
        error={checkout.error}
      />
    </View>
  );
};

const SaleScreen: React.FC<SaleScreenProps> = props => (
  <SaleProvider>
    <SaleScreenContent {...props} />
  </SaleProvider>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lightColors.background },
  splitLayout: { flex: 1, flexDirection: 'row' },
  stackedLayout: { flex: 1 },
  catalogueColumn: { flex: 1, backgroundColor: lightColors.background },
  basketColumn: { backgroundColor: lightColors.surface, borderLeftWidth: 1, borderLeftColor: lightColors.border },
});

export default SaleScreen;
