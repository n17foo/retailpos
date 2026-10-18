/**
 * BasketPanel — the one basket component shared by every device class
 * (docs/specs/system/sales-screen-fast-path-ux.md §4.6).
 *
 * Split shell (tablet/desktop/landscape): permanent right column.
 * Stacked shell (phone): inside the bottom sheet opened by BasketBar.
 *
 *  - Tap a line to select it → action strip: qty −/+, note, remove (≥ 44px).
 *  - Swipe left on a line removes it (touch); in pointer mode ↑↓ moves the
 *    selection and Delete/Backspace removes the selected line.
 *  - The most recently added line flashes briefly.
 *  - Tender buttons (CASH / CARD / ⋯) are pinned at the bottom.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, hitTarget } from '../../../shared/utils/theme';
import { BasketBlockers } from './BasketBlockers';
import { ECommercePlatform, isOnlinePlatform } from '../../../shared/utils/platforms';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import CustomerSearchModal from '../../customers/components/CustomerSearchModal';
import { PlatformCustomer } from '../../customers/services/customer/CustomerServiceInterface';
import { BasketItem, useBasketState } from '../contexts/BasketStateProvider';
import { useBasketActions } from '../contexts/BasketActionsProvider';
import { useCheckoutContext } from '../../checkout/contexts/CheckoutProvider';
import { useSale } from '../../checkout/contexts/SaleProvider';
import { posConfig } from '../../platform-clients/services/config/POSConfigService';
import { TenderBar } from '../../checkout/components/TenderBar';
import type { TenderShortcut } from '../../checkout/hooks/useCheckout';
import { BasketLineItem } from './BasketLineItem';
import { BasketMetaRow } from './BasketMetaRow';
import { LoyaltyActionsRow } from './LoyaltyActionsRow';
import { BasketSummary } from './BasketSummary';
import { basketPanelStyles as styles } from './basketPanelStyles';

interface BasketPanelProps {
  platform?: ECommercePlatform;
  onCheckout?: () => void;
  onTender?: (tender: TenderShortcut) => void;
  /** 'touch' gets 44/56px targets; 'pointer' gets keyboard controls + smaller targets */
  inputMode?: 'touch' | 'pointer';
}

/** Flash duration for the last-added line */
const FLASH_MS = 1200;

export const BasketPanel: React.FC<BasketPanelProps> = ({ platform, onCheckout, onTender, inputMode = 'touch' }) => {
  const currency = useCurrency();
  const { isLoading, basket, basketItems } = useBasketState();
  const { incrementQuantity, decrementQuantity, removeFromBasket, setCustomer, setNote, setLineProperties, applyDiscount } =
    useBasketActions();
  const { unsyncedOrdersCount, syncAllPendingOrders } = useCheckoutContext();
  const { blockers, blockingBlockers, saleState, getAvailableForItem, checkout, openTender, loyalty } = useSale();

  // Online platforms calculate tax for the whole basket when checkout starts
  const taxAtCheckout = !!platform && isOnlinePlatform(platform) && !checkout.currentOrder;

  // One-tap line-note chips (empty = none shown)
  const noteChips = useMemo(() => posConfig.values.saleNoteChips ?? [], []);

  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [noteEditLineId, setNoteEditLineId] = useState<string | null>(null);
  const [orderNoteVisible, setOrderNoteVisible] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [flashLineId, setFlashLineId] = useState<string | null>(null);

  // Flash the most recently added line
  const prevItemIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set(basketItems.map(i => i.id));
    const added = basketItems.find(i => !prevItemIdsRef.current.has(i.id));
    if (added) {
      setFlashLineId(added.id);
      const t = setTimeout(() => setFlashLineId(null), FLASH_MS);
      prevItemIdsRef.current = currentIds;
      return () => clearTimeout(t);
    }
    prevItemIdsRef.current = currentIds;
  }, [basketItems]);

  // Pointer mode: ArrowUp/ArrowDown move the selection, Delete/Backspace removes it
  useEffect(() => {
    if (inputMode !== 'pointer' || typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (basketItems.length === 0) return;
        e.preventDefault();
        const index = basketItems.findIndex(i => i.id === selectedLineId);
        const next =
          index === -1
            ? e.key === 'ArrowDown'
              ? 0
              : basketItems.length - 1
            : (index + (e.key === 'ArrowDown' ? 1 : -1) + basketItems.length) % basketItems.length;
        setSelectedLineId(basketItems[next].id);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedLineId) return;
        void removeFromBasket(selectedLineId);
        setSelectedLineId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputMode, selectedLineId, basketItems, removeFromBasket]);

  // Loyalty & store credit — balances owned by useSaleScreen, shared with CheckoutModal
  const {
    loyaltyBalance,
    storeCreditDollars,
    activeRedemption,
    isLoading: isRedemptionLoading,
    redeemLoyalty,
    redeemStoreCredit,
    reverseActiveRedemption,
  } = loyalty;

  const handleDecrement = async (itemId: string, currentQuantity: number) => {
    if (currentQuantity <= 1) {
      await removeFromBasket(itemId);
      setSelectedLineId(null);
    } else {
      await decrementQuantity(itemId);
    }
  };

  const handleRemoveLine = (itemId: string) => {
    void removeFromBasket(itemId);
    setSelectedLineId(null);
  };

  const handleSelectCustomer = async (customer: PlatformCustomer) => {
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
    await setCustomer(customer.email, name || customer.email);
    setCustomerModalVisible(false);
  };

  const handleSyncOrders = async () => {
    setIsSyncing(true);
    try {
      await syncAllPendingOrders();
    } finally {
      setIsSyncing(false);
    }
  };

  const isAtStockLimit = (item: BasketItem) => {
    const available = getAvailableForItem(item);
    return available !== undefined && item.quantity >= available;
  };

  const handleRedeemLoyalty = async (points: number) => {
    try {
      const discount = await redeemLoyalty(points);
      await applyDiscount(`LOYALTY_${discount.toFixed(2)}`);
    } catch {
      // error shown via hook state
    }
  };

  const handleRedeemStoreCredit = async (dollars: number) => {
    try {
      const result = await redeemStoreCredit(dollars);
      await applyDiscount(`CREDIT_${result.toFixed(2)}`);
    } catch {
      // error shown via hook state
    }
  };

  const handleTender = useCallback(
    (tender: TenderShortcut) => {
      if (saleState === 'needs-attention') {
        if (blockingBlockers[0]?.code === 'customer-required') setCustomerModalVisible(true);
        return;
      }
      if (onTender) onTender(tender);
      else openTender(tender);
      onCheckout?.();
    },
    [saleState, blockingBlockers, onTender, openTender, onCheckout]
  );

  const cardAvailable = checkout.paymentMode === 'tap_to_pay';
  const tenderDisabled = basketItems.length === 0 || checkout.isProcessing;
  const tenderError = checkout.error;

  const renderItem = ({ item }: { item: BasketItem }) => (
    <BasketLineItem
      item={item}
      currencyCode={currency.code}
      isSelected={selectedLineId === item.id}
      isFlashing={flashLineId === item.id}
      isNoteEditing={noteEditLineId === item.id}
      noteChips={noteChips}
      inputMode={inputMode}
      isAtStockLimit={isAtStockLimit}
      onToggleSelect={id => setSelectedLineId(selectedLineId === id ? null : id)}
      onDecrement={handleDecrement}
      onIncrement={id => void incrementQuantity(id)}
      onRemove={handleRemoveLine}
      onToggleNoteEdit={id => setNoteEditLineId(noteEditLineId === id ? null : id)}
      onNoteChip={(id, chip) => {
        void setLineProperties(id, { note: chip });
        setNoteEditLineId(null);
      }}
      onNoteSubmit={(id, note) => {
        void setLineProperties(id, { note });
        setNoteEditLineId(null);
      }}
    />
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={lightColors.primary} />
          <Text style={styles.loadingText}>Loading basket...</Text>
        </View>
      ) : basketItems.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="shopping-cart" size={48} color={lightColors.textSecondary} />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Text style={styles.emptyHint}>Scan or tap a product to add it</Text>
        </View>
      ) : (
        <FlatList
          data={basketItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          style={styles.cartList}
          showsVerticalScrollIndicator={inputMode === 'pointer'}
        />
      )}

      {blockers.length > 0 && (
        <View style={styles.blockersContainer}>
          <BasketBlockers
            blockers={blockers.map(blocker => ({
              ...blocker,
              action: blocker.action
                ? {
                    ...blocker.action,
                    onPress: () => {
                      if (blocker.code === 'customer-required') {
                        setCustomerModalVisible(true);
                      } else {
                        blocker.action?.onPress();
                      }
                    },
                  }
                : undefined,
            }))}
          />
        </View>
      )}

      {/* Customer + order note */}
      <BasketMetaRow
        customerEmail={basket?.customerEmail}
        customerName={basket?.customerName}
        hasOrderNote={!!basket?.note}
        orderNoteVisible={orderNoteVisible}
        onAddCustomer={() => setCustomerModalVisible(true)}
        onRemoveCustomer={() => setCustomer(undefined, undefined)}
        onToggleOrderNote={() => setOrderNoteVisible(!orderNoteVisible)}
      />

      {orderNoteVisible && (
        <TextInput
          style={styles.orderNoteInput}
          placeholder="Order note…"
          placeholderTextColor={lightColors.textHint}
          defaultValue={basket?.note ?? ''}
          blurOnSubmit
          returnKeyType="done"
          onEndEditing={e => void setNote(e.nativeEvent.text)}
        />
      )}

      {basket?.customerEmail && (
        <LoyaltyActionsRow
          loyaltyBalance={loyaltyBalance}
          storeCreditDollars={storeCreditDollars}
          activeRedemption={activeRedemption}
          isRedemptionLoading={isRedemptionLoading}
          currencyCode={currency.code}
          onRedeemLoyalty={points => void handleRedeemLoyalty(points)}
          onRedeemStoreCredit={dollars => void handleRedeemStoreCredit(dollars)}
          onReverseRedemption={reverseActiveRedemption}
        />
      )}

      <BasketSummary
        unsyncedOrdersCount={unsyncedOrdersCount}
        isSyncing={isSyncing}
        onSync={handleSyncOrders}
        subtotal={checkout.subtotal}
        tax={checkout.tax}
        total={checkout.total}
        taxAtCheckout={taxAtCheckout}
        error={tenderError}
        currencyCode={currency.code}
      />

      {/* Pinned tender buttons */}
      <TenderBar
        total={checkout.total}
        disabled={tenderDisabled}
        cardAvailable={cardAvailable}
        onTender={handleTender}
        targetSize={inputMode === 'touch' ? hitTarget.touchTender : hitTarget.pointerTender}
      />

      <CustomerSearchModal
        visible={customerModalVisible}
        platform={platform}
        onSelect={handleSelectCustomer}
        onClose={() => setCustomerModalVisible(false)}
      />
    </View>
  );
};
