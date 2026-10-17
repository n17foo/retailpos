/**
 * useSaleScreen
 *
 * Composes the sale-screen state hooks (catalogue, scanner, checkout, basket)
 * plus the layout/input-mode derivation. Mount it ONCE (via SaleProvider) and
 * share the result through context.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useBasketState } from '../../basket/contexts/BasketStateProvider';
import { useCheckoutContext } from '../contexts/CheckoutProvider';
import { useCategoryContext } from '../../catalogue/contexts/CategoryProvider';
import { useSaleCatalog } from '../../catalogue/hooks/useSaleCatalog';
import { useSaleScanner } from '../../scanning/hooks/useSaleScanner';
import { useCheckout } from './useCheckout';
import { useLoyaltyBasket } from '../../basket/hooks/useLoyaltyBasket';
import { useCashDrawerStatus } from '../../hardware/hooks/useCashDrawerStatus';
import { cashDrawerServiceFactory } from '../../hardware/services/drawer/CashDrawerServiceFactory';
import { posConfig } from '../../platform-clients/services/config/POSConfigService';
import { getSaleLayout } from '../../../shared/utils/responsive.utils';
import { getUserFacingSaleState, type UserFacingSaleState } from '../utils/orderStateMapper';
import { isElectron, isMobile } from '../../../shared/utils/electron';
import type { BasketBlocker, BlockerCode } from '../../basket/components/BasketBlockers';
import type { BasketItem } from '../../basket/services/basket';
import type { TenderShortcut } from './useCheckout';

export interface SaleBlocker extends BasketBlocker {
  code: BlockerCode;
}

/** 'auto' resolves to pointer on desktop/Electron/web and touch on native mobile */
export type SaleInputMode = 'touch' | 'pointer';

const resolveInputMode = (): SaleInputMode => {
  const configured = posConfig.values.saleInputMode ?? 'auto';
  if (configured === 'touch' || configured === 'pointer') return configured;
  return isMobile() && !isElectron() ? 'touch' : 'pointer';
};

export function useSaleScreen() {
  const { basketItems, basketItemsMap, itemCount, total, basket } = useBasketState();
  const { currentOrder, unsyncedOrdersCount, isProcessing, syncAllPendingOrders, isSyncing } = useCheckoutContext();
  const { clear: clearCategory } = useCategoryContext();

  const catalog = useSaleCatalog();
  const scanner = useSaleScanner({
    products: catalog.products,
    catalogPlatform: catalog.catalogPlatform,
    addProduct: catalog.addProduct,
  });

  // Basket sheet (phone stacked shell)
  const [isBasketSheetOpen, setIsBasketSheetOpen] = useState(false);

  // After a completed payment the sale UI returns to its initial state
  // ("All Products", no search) ready for the next customer (§4.7).
  const checkout = useCheckout({
    platform: catalog.currentPlatform ?? undefined,
    onSuccess: () => {
      clearCategory();
      catalog.clearSearch();
      setIsBasketSheetOpen(false);
    },
  });

  // Loyalty & store-credit balances — single instance shared by the basket
  // panel and the checkout modal (discount/loyalty redesign is deferred).
  const loyalty = useLoyaltyBasket(basket?.customerEmail, checkout.currentOrder?.id);
  const { loadBalances } = loyalty;
  useEffect(() => {
    void loadBalances();
  }, [basket?.customerEmail, loadBalances]);

  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => getSaleLayout(width, height), [width, height]);
  const inputMode = useMemo(resolveInputMode, []);

  // Cash-drawer status comes from the factory driver, polled while on the sale screen
  const drawerService = useMemo(() => cashDrawerServiceFactory.getService(), []);
  const { isOpen: isDrawerOpen } = useCashDrawerStatus(drawerService);

  /** One-tap tender — opens checkout straight into the right step (§4.7) */
  const openTender = useCallback(
    (tender: TenderShortcut) => {
      void checkout.handleStartCheckout(tender);
    },
    [checkout]
  );

  // ── UX State Management (sales-ux spec §2.2, §2.3) ────────────────────

  const blockers = useMemo((): SaleBlocker[] => {
    const result: SaleBlocker[] = [];

    // Blocker: discount requires a customer email (sales-ux spec §2.3.2)
    if (basket && basket.discountCode && !basket.customerEmail) {
      result.push({
        code: 'customer-required',
        type: 'warning',
        message: 'Customer email required for discount',
        action: { label: 'Add Customer', onPress: () => {} },
      });
    }

    basketItems.forEach(item => {
      const product = catalog.products.find(p => p.id === item.productId);
      if (product && product.variants && product.variants.length > 1 && !item.variantId) {
        result.push({
          code: 'variant-required',
          type: 'error',
          message: `Variant selection required for ${item.name}`,
          action: { label: 'Select Variant', onPress: () => {} },
        });
      }
    });

    // Info only: unsynced orders never prevent a sale (offline-first)
    if (unsyncedOrdersCount > 0) {
      result.push({
        code: 'unsynced-orders',
        type: 'info',
        message: `${unsyncedOrdersCount} ${unsyncedOrdersCount === 1 ? 'order' : 'orders'} pending sync`,
        action: { label: 'Retry Sync', onPress: () => void syncAllPendingOrders() },
      });
    }

    return result;
  }, [basket, basketItems, catalog.products, unsyncedOrdersCount, syncAllPendingOrders]);

  // Only warnings and errors stop checkout; info-level blockers are shown but do not change the sale state
  const blockingBlockers = useMemo(() => blockers.filter(b => b.type !== 'info'), [blockers]);

  const saleState: UserFacingSaleState = useMemo(() => {
    const serviceBasketItems: BasketItem[] = basketItems.map(item => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      sku: item.sku,
      image: typeof item.image === 'string' ? item.image : '',
    }));
    return getUserFacingSaleState(serviceBasketItems, currentOrder, blockingBlockers, isProcessing);
  }, [basketItems, currentOrder, blockingBlockers, isProcessing]);

  /** New sale after payment or explicit reset — clears catalogue selection and search */
  const resetSaleUi = useCallback(() => {
    clearCategory();
    catalog.clearSearch();
    setIsBasketSheetOpen(false);
  }, [clearCategory, catalog]);

  return {
    // Catalogue
    ...catalog,
    // Scanner
    scanNotice: scanner.notice,
    dismissScanNotice: scanner.dismissNotice,
    isCameraOpen: scanner.isCameraOpen,
    openCamera: scanner.openCamera,
    closeCamera: scanner.closeCamera,
    handleBarCodeScanned: scanner.handleBarCodeScanned,
    /** Direct scan entry point — the hidden HID capture field feeds this */
    handleScan: scanner.handleScan,
    // Basket
    basket,
    basketItems,
    basketItemsMap,
    itemCount,
    total,
    // Layout / input
    layout,
    inputMode,
    isElectron: isElectron(),
    // Basket sheet (stacked shell)
    isBasketSheetOpen,
    openBasketSheet: useCallback(() => setIsBasketSheetOpen(true), []),
    closeBasketSheet: useCallback(() => setIsBasketSheetOpen(false), []),
    // Drawer
    isDrawerOpen,
    // Checkout
    checkout,
    openTender,
    // Loyalty (shared balances)
    loyalty,
    // UX state
    saleState,
    blockers,
    blockingBlockers,
    unsyncedOrdersCount,
    isSyncing,
    syncAllPendingOrders,
    resetSaleUi,
  };
}
