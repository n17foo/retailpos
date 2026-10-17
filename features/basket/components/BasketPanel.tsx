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
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, TextInput, Animated, PanResponder } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, hitTarget, interactionStyle } from '../../../shared/utils/theme';
import { formatMoney, multiplyMoney } from '../../../shared/utils/money';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { BasketBlockers } from './BasketBlockers';
import { ECommercePlatform, isOnlinePlatform } from '../../../shared/utils/platforms';
import { useTranslate } from '../../../shared/hooks/useTranslate';
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

interface BasketPanelProps {
  platform?: ECommercePlatform;
  onCheckout?: () => void;
  onTender?: (tender: TenderShortcut) => void;
  /** 'touch' gets 44/56px targets; 'pointer' gets keyboard controls + smaller targets */
  inputMode?: 'touch' | 'pointer';
}

/** Flash duration for the last-added line */
const FLASH_MS = 1200;
/** Swipe distance that commits a remove */
const SWIPE_THRESHOLD = 96;

export const BasketPanel: React.FC<BasketPanelProps> = ({ platform, onCheckout, onTender, inputMode = 'touch' }) => {
  const currency = useCurrency();
  const { isLoading, basket, basketItems } = useBasketState();
  const { incrementQuantity, decrementQuantity, removeFromBasket, setCustomer, setNote, setLineProperties, applyDiscount } =
    useBasketActions();
  const { unsyncedOrdersCount, syncAllPendingOrders } = useCheckoutContext();
  const { blockers, blockingBlockers, saleState, getAvailableForItem, checkout, openTender, loyalty } = useSale();
  const { t } = useTranslate();

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

  // ── Line rendering ───────────────────────────────────────────────────

  const renderActionStrip = (item: BasketItem) => (
    <View style={styles.actionStrip}>
      <Pressable
        style={state => [styles.actionButton, { minWidth: hitTarget.touchMin, minHeight: hitTarget.touchMin }, interactionStyle(state)]}
        onPress={() => handleDecrement(item.id, item.quantity)}
        accessibilityLabel={`Decrease quantity of ${item.name}`}
        accessibilityRole="button"
      >
        <MaterialIcons name="remove" size={20} color={lightColors.primary} />
      </Pressable>
      <Text style={styles.actionQty} accessibilityLabel={`Quantity: ${item.quantity}`} maxFontSizeMultiplier={1.5}>
        {item.quantity}
      </Text>
      <Pressable
        style={state => [
          styles.actionButton,
          { minWidth: hitTarget.touchMin, minHeight: hitTarget.touchMin },
          isAtStockLimit(item) && styles.buttonDisabled,
          !isAtStockLimit(item) && interactionStyle(state),
        ]}
        onPress={() => incrementQuantity(item.id)}
        disabled={isAtStockLimit(item)}
        accessibilityLabel={`Increase quantity of ${item.name}`}
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={20} color={lightColors.primary} />
      </Pressable>

      <View style={styles.actionSpacer} />

      <Pressable
        style={state => [
          styles.actionButton,
          { minWidth: hitTarget.touchMin, minHeight: hitTarget.touchMin },
          noteEditLineId === item.id && styles.actionButtonActive,
          interactionStyle(state),
        ]}
        onPress={() => setNoteEditLineId(noteEditLineId === item.id ? null : item.id)}
        accessibilityLabel={`Note for ${item.name}`}
        accessibilityRole="button"
        accessibilityState={{ selected: noteEditLineId === item.id }}
      >
        <MaterialIcons name="note" size={20} color={noteEditLineId === item.id ? lightColors.textOnPrimary : lightColors.primary} />
      </Pressable>
      <Pressable
        style={state => [styles.actionButton, { minWidth: hitTarget.touchMin, minHeight: hitTarget.touchMin }, interactionStyle(state)]}
        onPress={() => {
          void removeFromBasket(item.id);
          setSelectedLineId(null);
        }}
        accessibilityLabel={`Remove ${item.name} from cart`}
        accessibilityRole="button"
      >
        <MaterialIcons name="delete-outline" size={20} color={lightColors.error} />
      </Pressable>
    </View>
  );

  const renderItem = ({ item }: { item: BasketItem }) => (
    <SwipeableLine key={item.id} onRemove={inputMode === 'touch' ? () => void removeFromBasket(item.id) : undefined}>
      <Pressable
        style={state => [
          styles.cartItem,
          selectedLineId === item.id && styles.cartItemSelected,
          flashLineId === item.id && styles.cartItemFlash,
          interactionStyle(state),
        ]}
        onPress={() => setSelectedLineId(selectedLineId === item.id ? null : item.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: selectedLineId === item.id }}
        accessibilityLabel={`${item.name}, ${item.quantity} × ${formatMoney(item.price, currency.code)}`}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2} maxFontSizeMultiplier={1.5}>
            {item.name}
          </Text>
          <Text style={styles.itemPrice} maxFontSizeMultiplier={1.5}>
            {formatMoney(item.price, currency.code)}
          </Text>
          {item.optionSummary && (
            <Text style={styles.itemOptions} maxFontSizeMultiplier={1.5}>
              {item.optionSummary}
            </Text>
          )}
          {item.sku && (
            <Text style={styles.itemSku} maxFontSizeMultiplier={1.5}>
              {item.sku}
            </Text>
          )}
          {item.properties?.note && (
            <View style={styles.itemNoteRow}>
              <MaterialIcons name="note" size={12} color={lightColors.textSecondary} />
              <Text style={styles.itemNote} numberOfLines={1} maxFontSizeMultiplier={1.5}>
                {item.properties.note}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemQty} maxFontSizeMultiplier={1.5}>
            ×{item.quantity}
          </Text>
          <Text style={styles.itemTotal} maxFontSizeMultiplier={1.5}>
            {formatMoney(multiplyMoney(item.price, item.quantity), currency.code)}
          </Text>
        </View>
      </Pressable>

      {selectedLineId === item.id && renderActionStrip(item)}

      {noteEditLineId === item.id && selectedLineId === item.id && (
        <View style={styles.noteEditor}>
          {noteChips.length > 0 && (
            <View style={styles.noteChipsRow}>
              {noteChips.map(chip => (
                <Pressable
                  key={chip}
                  style={state => [styles.noteChip, interactionStyle(state)]}
                  onPress={() => {
                    void setLineProperties(item.id, { note: chip });
                    setNoteEditLineId(null);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.noteChipText}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <TextInput
            style={styles.noteInput}
            placeholder="Line note…"
            placeholderTextColor={lightColors.textHint}
            defaultValue={item.properties?.note ?? ''}
            autoFocus
            blurOnSubmit
            returnKeyType="done"
            onEndEditing={e => {
              void setLineProperties(item.id, { note: e.nativeEvent.text });
              setNoteEditLineId(null);
            }}
          />
        </View>
      )}
    </SwipeableLine>
  );

  const tenderError = checkout.error;

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

      {/* Customer + order note + loyalty */}
      <View style={styles.metaRow}>
        {basket?.customerEmail ? (
          <View style={styles.customerBadge}>
            <MaterialIcons name="person" size={16} color={lightColors.primary} />
            <Text style={styles.customerBadgeName} numberOfLines={1}>
              {basket.customerName || basket.customerEmail}
            </Text>
            <Pressable
              onPress={() => setCustomer(undefined, undefined)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Remove customer"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={16} color={lightColors.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={state => [styles.metaButton, interactionStyle(state)]}
            onPress={() => setCustomerModalVisible(true)}
            accessibilityLabel="Add customer to order"
            accessibilityRole="button"
          >
            <MaterialIcons name="person-add" size={16} color={lightColors.primary} />
            <Text style={styles.metaButtonText}>Customer</Text>
          </Pressable>
        )}
        <Pressable
          style={state => [styles.metaButton, (orderNoteVisible || basket?.note) && styles.metaButtonActive, interactionStyle(state)]}
          onPress={() => setOrderNoteVisible(!orderNoteVisible)}
          accessibilityLabel="Order note"
          accessibilityRole="button"
        >
          <MaterialIcons name="sticky-note-2" size={16} color={basket?.note ? lightColors.primary : lightColors.textSecondary} />
          <Text style={styles.metaButtonText}>Note</Text>
        </Pressable>
      </View>

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
        <View style={styles.loyaltyActions}>
          {loyaltyBalance && loyaltyBalance.points > 0 && !activeRedemption && (
            <Pressable
              style={state => [styles.loyaltyBtn, isRedemptionLoading && styles.buttonDisabled, interactionStyle(state)]}
              onPress={async () => {
                try {
                  const discount = await redeemLoyalty(loyaltyBalance.points);
                  await applyDiscount(`LOYALTY_${discount.toFixed(2)}`);
                } catch {
                  // error shown via hook state
                }
              }}
              disabled={isRedemptionLoading}
              accessibilityRole="button"
              accessibilityLabel={`Redeem ${loyaltyBalance.points} loyalty points`}
            >
              <MaterialIcons name="stars" size={14} color={lightColors.primary} />
              <Text style={styles.loyaltyBtnText}>
                Redeem {loyaltyBalance.points} pts ({formatMoney(loyaltyBalance.valueInCents / 100, currency.code)})
              </Text>
            </Pressable>
          )}
          {storeCreditDollars > 0 && !activeRedemption && (
            <Pressable
              style={state => [styles.loyaltyBtn, isRedemptionLoading && styles.buttonDisabled, interactionStyle(state)]}
              onPress={async () => {
                try {
                  const result = await redeemStoreCredit(storeCreditDollars);
                  await applyDiscount(`CREDIT_${result.toFixed(2)}`);
                } catch {
                  // error shown via hook state
                }
              }}
              disabled={isRedemptionLoading}
              accessibilityRole="button"
              accessibilityLabel={`Use ${formatMoney(storeCreditDollars, currency.code)} store credit`}
            >
              <MaterialIcons name="card-giftcard" size={14} color={lightColors.success} />
              <Text style={[styles.loyaltyBtnText, { color: lightColors.success }]}>
                Use {formatMoney(storeCreditDollars, currency.code)} store credit
              </Text>
            </Pressable>
          )}
          {activeRedemption && (
            <Pressable
              style={state => [styles.loyaltyReversalBtn, interactionStyle(state)]}
              onPress={reverseActiveRedemption}
              accessibilityRole="button"
              accessibilityLabel="Remove redemption"
            >
              <MaterialIcons name="undo" size={14} color={lightColors.warning} />
              <Text style={[styles.loyaltyBtnText, { color: lightColors.warning }]}>
                {activeRedemption.type === 'loyalty' ? 'Points' : 'Credit'} applied (−
                {formatMoney(activeRedemption.discountDollars, currency.code)}) · Undo
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Summary */}
      <View style={styles.summary}>
        {unsyncedOrdersCount > 0 && (
          <Pressable
            style={state => [styles.syncBanner, !isSyncing && interactionStyle(state)]}
            onPress={handleSyncOrders}
            disabled={isSyncing}
          >
            <StatusBadge status="pending" label={isSyncing ? 'Syncing...' : `${unsyncedOrdersCount} pending sync`} />
            {isSyncing && <ActivityIndicator size="small" color={lightColors.textOnPrimary} />}
          </Pressable>
        )}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.5}>
            Subtotal
          </Text>
          <Text style={styles.summaryValue} maxFontSizeMultiplier={1.5}>
            {formatMoney(checkout.subtotal, currency.code)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.5}>
            Tax
          </Text>
          <Text style={styles.summaryValue} maxFontSizeMultiplier={1.5}>
            {taxAtCheckout ? t('basket.taxAtCheckout') : formatMoney(checkout.tax, currency.code)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel} maxFontSizeMultiplier={1.5}>
            {taxAtCheckout ? t('basket.totalBeforeTax') : 'Total'}
          </Text>
          <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.5}>
            {formatMoney(checkout.total, currency.code)}
          </Text>
        </View>

        {tenderError && <Text style={styles.errorText}>{tenderError}</Text>}
      </View>

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

// ---------------------------------------------------------------------------
// SwipeableLine — touch-only swipe-left-to-remove wrapper
// ---------------------------------------------------------------------------

const SwipeableLine: React.FC<{ onRemove?: () => void; children: React.ReactNode }> = ({ onRemove, children }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const removedRef = useRef(false);

  const panResponder = useMemo(
    () =>
      onRemove
        ? PanResponder.create({
            onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) && g.dx < 0,
            onPanResponderMove: (_e, g) => {
              if (g.dx < 0) translateX.setValue(Math.max(g.dx, -140));
            },
            onPanResponderRelease: (_e, g) => {
              if (g.dx <= -SWIPE_THRESHOLD && !removedRef.current) {
                removedRef.current = true;
                Animated.timing(translateX, { toValue: -400, duration: 150, useNativeDriver: true }).start(() => onRemove());
              } else {
                Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
              }
            },
          })
        : null,
    [onRemove, translateX]
  );

  return (
    <View style={styles.swipeContainer}>
      {onRemove && (
        <View style={styles.swipeDelete}>
          <MaterialIcons name="delete" size={22} color={lightColors.textOnPrimary} />
        </View>
      )}
      <Animated.View style={{ transform: [{ translateX }] }} {...(panResponder?.panHandlers ?? {})}>
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xl },
  loadingText: { fontSize: typography.fontSize.md, color: lightColors.textSecondary, marginTop: spacing.md },
  emptyText: { fontSize: typography.fontSize.md, color: lightColors.textSecondary, fontWeight: '600', marginTop: spacing.md },
  emptyHint: { fontSize: typography.fontSize.sm, color: lightColors.textHint, marginTop: spacing.xs },
  cartList: { flex: 1, paddingHorizontal: spacing.sm },

  swipeContainer: { overflow: 'hidden' },
  swipeDelete: {
    ...StyleSheet.absoluteFill,
    backgroundColor: lightColors.error,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: spacing.lg,
    borderRadius: borderRadius.sm,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: lightColors.surface,
  },
  cartItemSelected: { backgroundColor: lightColors.pressed },
  cartItemFlash: { backgroundColor: lightColors.primary + '18' },
  itemInfo: { flex: 1, marginRight: spacing.sm },
  itemName: { fontSize: typography.fontSize.sm, fontWeight: '500', color: lightColors.textPrimary },
  itemPrice: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 2 },
  itemOptions: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 1 },
  itemSku: { fontSize: 10, color: lightColors.textHint, marginTop: 1 },
  itemNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  itemNote: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, fontStyle: 'italic' },
  itemRight: { alignItems: 'flex-end' },
  itemQty: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary },
  itemTotal: { fontSize: typography.fontSize.sm, fontWeight: '600', color: lightColors.textPrimary, minWidth: 56, textAlign: 'right' },

  actionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: lightColors.pressed,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  actionButton: { alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.sm },
  actionButtonActive: { backgroundColor: lightColors.primary },
  actionQty: { fontSize: typography.fontSize.md, fontWeight: '700', color: lightColors.textPrimary, minWidth: 28, textAlign: 'center' },
  actionSpacer: { flex: 1 },
  noteEditor: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: lightColors.border },
  noteChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  noteChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  noteChipText: { fontSize: typography.fontSize.sm, color: lightColors.textPrimary, fontWeight: '500' },
  noteInput: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.background,
  },

  blockersContainer: { paddingHorizontal: spacing.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  metaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: hitTarget.pointerTender,
    paddingHorizontal: spacing.xs,
  },
  metaButtonActive: { opacity: 1 },
  metaButtonText: { fontSize: typography.fontSize.sm, color: lightColors.primary, fontWeight: '600' },
  customerBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  customerBadgeName: { flex: 1, fontSize: typography.fontSize.sm, color: lightColors.textPrimary, fontWeight: '500' },
  orderNoteInput: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.background,
  },
  loyaltyActions: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs, gap: spacing.xs },
  loyaltyBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  loyaltyBtnText: { fontSize: typography.fontSize.sm, fontWeight: '600', color: lightColors.primary },
  loyaltyReversalBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  buttonDisabled: { opacity: 0.4 },
  summary: {
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: lightColors.surface,
  },
  syncBanner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  summaryLabel: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary },
  summaryValue: { fontSize: typography.fontSize.sm, color: lightColors.textPrimary },
  totalRow: { marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: lightColors.border, paddingTop: spacing.sm },
  totalLabel: { fontSize: typography.fontSize.lg, fontWeight: '700', color: lightColors.textPrimary },
  totalValue: { fontSize: typography.fontSize.lg, fontWeight: '700', color: lightColors.primary },
  errorText: { fontSize: typography.fontSize.sm, color: lightColors.error, paddingVertical: spacing.xs, textAlign: 'center' },
});
