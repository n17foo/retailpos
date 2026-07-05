import React, { useState, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation, semanticColors } from '../utils/theme';
import { formatMoney } from '../utils/money';
import { Button } from './Button';
import PinKeypad from './PinKeypad';
import { useCurrency } from '../hooks/useCurrency';
import { useTranslate } from '../hooks/useTranslate';
import type { PaymentLine as OrderPaymentLine } from '../services/order/order';
import type { PaymentMode } from '../hooks/usePayment';
import { PaymentProvider } from '../services/payment/PaymentServiceFactory';

export type PaymentMethod = 'cash' | 'card' | 'terminal' | 'store_credit' | 'loyalty';

export interface PaymentSelection {
  method: PaymentMethod;
  /** Only set for cash payments — amount the customer handed over */
  tenderedAmount?: number;
}

interface CheckoutModalProps {
  visible: boolean;
  orderId: string;
  orderTotal: number;
  orderSubtotal: number;
  orderTax: number;
  itemCount: number;
  onSelectPayment: (selection: PaymentSelection) => void;
  onCancel: () => void;
  isProcessing?: boolean;
  terminalConnected?: boolean;
  /**
   * Payment mode derived from the active provider and device type.
   * Drives which payment options are shown.
   */
  paymentMode?: PaymentMode;
  /** The currently active payment provider — used for labelling the terminal option. */
  activeProvider?: PaymentProvider;
  /** Collected payment lines so far (split tender) */
  paymentLines?: OrderPaymentLine[];
  onAddPaymentLine?: (line: Omit<OrderPaymentLine, 'id' | 'processedAt'>) => void;
  onRemovePaymentLine?: (lineId: string) => void;
  onCompleteSplit?: () => void;
  splitMode?: boolean;
  /** Amount for cash tender in split mode (null = not in cash tender) */
  splitCashTenderAmount?: number | null;
  onConfirmSplitCash?: (tenderedAmount: number) => void;
  /** Customer email for loyalty/store credit */
  customerEmail?: string;
  /** Available loyalty points */
  loyaltyPoints?: number;
  /** Available store credit in dollars */
  storeCreditDollars?: number;
}

type ModalStep = 'method' | 'cash_tender' | 'split_tender';

// ---------------------------------------------------------------------------
// Provider → human-readable label + icon
// ---------------------------------------------------------------------------

const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  [PaymentProvider.STRIPE_NFC]: 'Stripe NFC',
  [PaymentProvider.STRIPE]: 'Stripe Terminal',
  [PaymentProvider.SQUARE]: 'Square',
  [PaymentProvider.ADYEN]: 'Adyen',
  [PaymentProvider.TAP_PAYMENTS]: 'Tap Payments',
  [PaymentProvider.INSTORE_API]: 'Instore PED',
};

const PROVIDER_ICON: Record<PaymentProvider, string> = {
  [PaymentProvider.STRIPE_NFC]: '📲',
  [PaymentProvider.STRIPE]: '💳',
  [PaymentProvider.SQUARE]: '🟦',
  [PaymentProvider.ADYEN]: '💳',
  [PaymentProvider.TAP_PAYMENTS]: '📲',
  [PaymentProvider.INSTORE_API]: '🏪',
};

// ---------------------------------------------------------------------------
// Build the available payment method list for the current context
// ---------------------------------------------------------------------------

interface MethodEntry {
  id: PaymentMethod;
  label: string;
  icon: string;
  description: string;
}

function buildMethodList(paymentMode: PaymentMode, activeProvider: PaymentProvider | undefined, terminalConnected: boolean): MethodEntry[] {
  const methods: MethodEntry[] = [];

  // Cash is always available on every device.
  methods.push({
    id: 'cash',
    label: 'Cash',
    icon: '💵',
    description: 'Accept physical cash and calculate change',
  });

  // Tap-to-pay is only available on mobile/tablet with an SDK provider.
  if (paymentMode === 'tap_to_pay' && activeProvider) {
    const providerLabel = PROVIDER_LABEL[activeProvider] ?? activeProvider;
    const providerIcon = PROVIDER_ICON[activeProvider] ?? '📱';
    const isNfc = activeProvider === PaymentProvider.STRIPE_NFC || activeProvider === PaymentProvider.TAP_PAYMENTS;
    methods.push({
      id: 'terminal',
      label: isNfc ? `Tap to Pay (${providerLabel})` : `Card Terminal (${providerLabel})`,
      icon: providerIcon,
      description: terminalConnected
        ? isNfc
          ? 'Customer taps card or device to pay'
          : 'Customer presents card to the reader'
        : 'Terminal not connected — tap to connect',
    });
  }

  return methods;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = props => {
  const currency = useCurrency();
  const { t } = useTranslate();
  const {
    visible,
    orderId,
    orderTotal,
    orderSubtotal,
    orderTax,
    itemCount,
    onSelectPayment,
    onCancel,
    isProcessing = false,
    terminalConnected = false,
    paymentMode = 'cash_only',
    activeProvider,
    paymentLines = [],
    onAddPaymentLine,
    onRemovePaymentLine,
    onCompleteSplit,
    splitMode = false,
    splitCashTenderAmount = null,
    onConfirmSplitCash,
    customerEmail,
    loyaltyPoints = 0,
    storeCreditDollars = 0,
  } = props;

  // Build the available method list for this device + provider combination.
  const availableMethods = buildMethodList(paymentMode, activeProvider, terminalConnected);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [step, setStep] = useState<ModalStep>(splitMode ? 'split_tender' : 'method');
  // Cash tendering — stored as a string so the keypad can build it digit by digit
  const [tenderedStr, setTenderedStr] = useState('');
  // Split tender — amount input for the current line being added
  const [splitAmountStr, setSplitAmountStr] = useState('');
  const [splitMethod, setSplitMethod] = useState<PaymentMethod>('cash');

  // When splitCashTenderAmount is set, transition to cash_tender step
  React.useEffect(() => {
    if (splitCashTenderAmount !== null && splitCashTenderAmount > 0) {
      setTenderedStr('');
      setStep('cash_tender');
    }
  }, [splitCashTenderAmount]);

  // Reset to method selection whenever the modal opens
  const handleCancel = useCallback(() => {
    setStep('method');
    setTenderedStr('');
    setSplitAmountStr('');
    onCancel();
  }, [onCancel]);

  // "Pay" button on the method selection step
  const handleMethodConfirm = useCallback(() => {
    if (selectedMethod === 'cash') {
      setTenderedStr('');
      setStep('cash_tender');
    } else {
      onSelectPayment({ method: selectedMethod });
    }
  }, [selectedMethod, onSelectPayment]);

  // Keypad handlers for cash tendering
  const handleKeyPress = useCallback((key: string) => {
    if (key === 'biometric') return;
    setTenderedStr(prev => {
      // Prevent more than two decimal places
      const dotIdx = prev.indexOf('.');
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
      // Prevent leading zeros (except "0.")
      if (prev === '0' && key !== '.') return key;
      // Only one decimal point
      if (key === '.' && prev.includes('.')) return prev;
      return prev + key;
    });
  }, []);

  const handleDelete = useCallback(() => {
    setTenderedStr(prev => prev.slice(0, -1));
  }, []);

  // Calculate tender validation for handleCashConfirm callback
  const amountDue = splitCashTenderAmount ?? orderTotal;
  const tenderedAmount = parseFloat(tenderedStr) || 0;
  const isTenderValid = tenderedAmount >= amountDue;

  const handleCashConfirm = useCallback(() => {
    if (!isTenderValid) return;
    // If in split mode with a specific amount, confirm that amount
    if (splitCashTenderAmount !== null && onConfirmSplitCash) {
      onConfirmSplitCash(tenderedAmount);
      setStep('split_tender');
    } else {
      // Regular single-tender cash payment
      onSelectPayment({ method: 'cash', tenderedAmount });
    }
  }, [isTenderValid, tenderedAmount, onSelectPayment, splitCashTenderAmount, onConfirmSplitCash]);

  // ── Split tender step ────────────────────────────────────────────────────
  if (step === 'split_tender') {
    const collected = paymentLines.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, orderTotal - collected);
    const splitAmount = parseFloat(splitAmountStr) || 0;
    const isSplitAmountValid = splitAmount > 0 && splitAmount <= remaining + 0.001;
    const isSettled = remaining <= 0.01;

    const methodLabel = (m: PaymentMethod | 'card_terminal') => {
      switch (m) {
        case 'cash':
          return '💵 Cash';
        case 'card':
          return '💳 Card';
        case 'terminal':
        case 'card_terminal':
          return '📱 Terminal';
        case 'store_credit':
          return '🎁 Store Credit';
        case 'loyalty':
          return '⭐ Loyalty Points';
        default:
          return m;
      }
    };

    const handleAddSplitLine = () => {
      if (!isSplitAmountValid || !onAddPaymentLine) return;
      const mappedMethod = splitMethod === 'terminal' ? 'card_terminal' : splitMethod;

      // For cash, the hook will trigger cash tendering
      // For card/terminal, the hook will process payment
      onAddPaymentLine({ method: mappedMethod, amount: splitAmount });
      setSplitAmountStr('');
    };

    return (
      <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => setStep('method')}
                style={styles.backButton}
                disabled={isProcessing}
                accessibilityLabel={t('common.back')}
                accessibilityRole="button"
              >
                <Text style={styles.backText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Split Payment</Text>
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.closeButton}
                disabled={isProcessing}
                accessibilityLabel={t('checkout.cancelCheckout')}
                accessibilityRole="button"
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Order total */}
              <View style={styles.amountDueRow}>
                <Text style={styles.amountDueLabel}>Order Total</Text>
                <Text style={styles.amountDueValue}>{formatMoney(orderTotal, currency.code)}</Text>
              </View>

              {/* Collected lines */}
              {paymentLines.length > 0 && (
                <View style={styles.splitLinesContainer}>
                  {paymentLines.map(line => (
                    <View key={line.id} style={styles.splitLine}>
                      <Text style={styles.splitLineMethod}>{methodLabel(line.method as PaymentMethod)}</Text>
                      <Text style={styles.splitLineAmount}>{formatMoney(line.amount, currency.code)}</Text>
                      {onRemovePaymentLine && (
                        <TouchableOpacity
                          onPress={() => onRemovePaymentLine(line.id)}
                          style={styles.splitLineRemove}
                          accessibilityLabel="Remove payment line"
                          accessibilityRole="button"
                        >
                          <Text style={styles.splitLineRemoveText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Running totals */}
              <View style={styles.splitTotalsRow}>
                <View style={styles.splitTotalItem}>
                  <Text style={styles.splitTotalLabel}>Collected</Text>
                  <Text style={[styles.splitTotalValue, { color: lightColors.success }]}>{formatMoney(collected, currency.code)}</Text>
                </View>
                <View style={styles.splitTotalItem}>
                  <Text style={styles.splitTotalLabel}>Remaining</Text>
                  <Text style={[styles.splitTotalValue, { color: remaining > 0.01 ? lightColors.error : lightColors.success }]}>
                    {formatMoney(remaining, currency.code)}
                  </Text>
                </View>
              </View>

              {/* Add payment line */}
              {!isSettled && (
                <View style={styles.splitAddSection}>
                  <Text style={styles.sectionTitle}>Add Payment</Text>
                  <View style={styles.splitMethodRow}>
                    {(['cash', ...(paymentMode === 'tap_to_pay' ? ['terminal'] : [])] as PaymentMethod[]).map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.splitMethodButton, splitMethod === m && styles.splitMethodButtonSelected]}
                        onPress={() => setSplitMethod(m)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: splitMethod === m }}
                      >
                        <Text style={[styles.splitMethodButtonText, splitMethod === m && styles.splitMethodButtonTextSelected]}>
                          {methodLabel(m)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Store Credit / Loyalty buttons (only if customer attached and balance available) */}
                  {customerEmail && (storeCreditDollars > 0 || loyaltyPoints > 0) && (
                    <View style={styles.splitMethodRow}>
                      {storeCreditDollars > 0 && (
                        <TouchableOpacity
                          style={[styles.splitMethodButton, splitMethod === 'store_credit' && styles.splitMethodButtonSelected]}
                          onPress={() => setSplitMethod('store_credit')}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: splitMethod === 'store_credit' }}
                        >
                          <Text
                            style={[styles.splitMethodButtonText, splitMethod === 'store_credit' && styles.splitMethodButtonTextSelected]}
                          >
                            🎁 Credit ({formatMoney(storeCreditDollars, currency.code)})
                          </Text>
                        </TouchableOpacity>
                      )}
                      {loyaltyPoints > 0 && (
                        <TouchableOpacity
                          style={[styles.splitMethodButton, splitMethod === 'loyalty' && styles.splitMethodButtonSelected]}
                          onPress={() => setSplitMethod('loyalty')}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: splitMethod === 'loyalty' }}
                        >
                          <Text style={[styles.splitMethodButtonText, splitMethod === 'loyalty' && styles.splitMethodButtonTextSelected]}>
                            ⭐ Points ({loyaltyPoints})
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  <TextInput
                    style={styles.splitAmountInput}
                    value={splitAmountStr}
                    onChangeText={setSplitAmountStr}
                    placeholder={`Amount (max ${formatMoney(remaining, currency.code)})`}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Split payment amount"
                  />
                  <Button
                    title="Add Payment"
                    variant="primary"
                    fullWidth
                    onPress={handleAddSplitLine}
                    disabled={!isSplitAmountValid || isProcessing}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.actions}>
              <Button
                title={isProcessing ? t('common.processing') : 'Complete Sale'}
                variant="success"
                size="lg"
                fullWidth
                onPress={onCompleteSplit}
                loading={isProcessing}
                disabled={isProcessing || !isSettled || !onCompleteSplit}
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Cash tendering step ──────────────────────────────────────────────────
  if (step === 'cash_tender') {
    // In split mode, use the split cash tender amount; otherwise use full order total
    const amountDue = splitCashTenderAmount ?? orderTotal;
    const tenderedAmount = parseFloat(tenderedStr) || 0;
    const changeDue = tenderedAmount - amountDue;
    const isTenderValid = tenderedAmount >= amountDue;

    return (
      <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => setStep(splitCashTenderAmount !== null ? 'split_tender' : 'method')}
                style={styles.backButton}
                disabled={isProcessing}
                accessibilityLabel={t('common.back')}
                accessibilityRole="button"
              >
                <Text style={styles.backText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{splitCashTenderAmount !== null ? 'Cash Payment (Split)' : t('checkout.cashPayment')}</Text>
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.closeButton}
                disabled={isProcessing}
                accessibilityLabel={t('checkout.cancelCheckout')}
                accessibilityRole="button"
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Amount due */}
              <View style={styles.amountDueRow}>
                <Text style={styles.amountDueLabel}>{t('checkout.amountDue')}</Text>
                <Text style={styles.amountDueValue}>{formatMoney(amountDue, currency.code)}</Text>
              </View>

              {/* Tendered display */}
              <View style={styles.tenderedDisplay}>
                <Text style={styles.tenderedLabel}>{t('checkout.cashTendered')}</Text>
                <Text style={[styles.tenderedValue, !tenderedStr && styles.tenderedPlaceholder]}>
                  {tenderedStr ? formatMoney(tenderedAmount, currency.code) : formatMoney(0, currency.code)}
                </Text>
              </View>

              {/* Change due */}
              <View style={[styles.changeRow, isTenderValid ? styles.changePositive : styles.changeInsufficient]}>
                <Text style={styles.changeLabel}>{isTenderValid ? t('checkout.changeDue') : t('checkout.amountShort')}</Text>
                <Text style={styles.changeValue}>
                  {isTenderValid ? formatMoney(changeDue, currency.code) : formatMoney(amountDue - tenderedAmount, currency.code)}
                </Text>
              </View>

              {/* Quick-tender shortcuts */}
              <View style={styles.quickAmounts}>
                {(() => {
                  const ceil = Math.ceil(amountDue);
                  return [
                    { label: t('checkout.exact'), value: amountDue },
                    ...(ceil !== amountDue ? [{ label: formatMoney(ceil, currency.code), value: ceil }] : []),
                    { label: formatMoney(Math.ceil(amountDue / 5) * 5, currency.code), value: Math.ceil(amountDue / 5) * 5 },
                    { label: formatMoney(Math.ceil(amountDue / 10) * 10, currency.code), value: Math.ceil(amountDue / 10) * 10 },
                    { label: formatMoney(Math.ceil(amountDue / 20) * 20, currency.code), value: Math.ceil(amountDue / 20) * 20 },
                  ].filter((v, i, arr) => arr.findIndex(x => x.value === v.value) === i);
                })().map(qa => (
                  <TouchableOpacity
                    key={qa.value}
                    style={styles.quickAmountButton}
                    onPress={() => setTenderedStr(qa.value.toFixed(2))}
                    accessibilityRole="button"
                    accessibilityLabel={qa.label}
                  >
                    <Text style={styles.quickAmountText}>{qa.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Keypad */}
              <View style={styles.keypadWrapper}>
                <PinKeypad onKeyPress={handleKeyPress} onDeletePress={handleDelete} disableBiometric />
              </View>
            </ScrollView>

            {/* Confirm */}
            <View style={styles.actions}>
              <Button
                title={
                  isProcessing
                    ? t('common.processing')
                    : isTenderValid
                      ? splitCashTenderAmount !== null
                        ? `Add Cash Payment (Change: ${formatMoney(changeDue, currency.code)})`
                        : t('checkout.confirmCash', { change: formatMoney(changeDue, currency.code) })
                      : t('checkout.enterAmount')
                }
                variant="success"
                size="lg"
                fullWidth
                onPress={handleCashConfirm}
                loading={isProcessing}
                disabled={isProcessing || !isTenderValid}
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Method selection step ────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('checkout.completeOrder')}</Text>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.closeButton}
              disabled={isProcessing}
              accessibilityLabel={t('checkout.cancelCheckout')}
              accessibilityRole="button"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Order Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.orderRef}>{t('checkout.orderRef', { ref: orderId.slice(-8) })}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('checkout.items')}</Text>
                <Text style={styles.summaryValue}>{itemCount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('checkout.subtotal')}</Text>
                <Text style={styles.summaryValue}>{formatMoney(orderSubtotal, currency.code)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('checkout.tax')}</Text>
                <Text style={styles.summaryValue}>{formatMoney(orderTax, currency.code)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
                <Text style={styles.totalValue}>{formatMoney(orderTotal, currency.code)}</Text>
              </View>

              {/* Loyalty & Store Credit Info */}
              {customerEmail && (loyaltyPoints > 0 || storeCreditDollars > 0) && (
                <View style={styles.loyaltyInfo}>
                  {loyaltyPoints > 0 && (
                    <View style={styles.loyaltyRow}>
                      <Text style={styles.loyaltyIcon}>⭐</Text>
                      <Text style={styles.loyaltyText}>{loyaltyPoints} loyalty points available</Text>
                    </View>
                  )}
                  {storeCreditDollars > 0 && (
                    <View style={styles.loyaltyRow}>
                      <Text style={styles.loyaltyIcon}>💳</Text>
                      <Text style={styles.loyaltyText}>{formatMoney(storeCreditDollars, currency.code)} store credit available</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Payment Method Selection */}
            <Text style={styles.sectionTitle}>{t('checkout.paymentMethod')}</Text>
            <View style={styles.paymentMethods}>
              {availableMethods.map(method => {
                const isSelected = selectedMethod === method.id;
                const isDisabled = method.id === 'terminal' && !terminalConnected;

                return (
                  <TouchableOpacity
                    key={method.id}
                    style={[styles.paymentOption, isSelected && styles.paymentOptionSelected, isDisabled && styles.paymentOptionDisabled]}
                    onPress={() => !isDisabled && setSelectedMethod(method.id)}
                    disabled={isDisabled}
                    activeOpacity={0.7}
                    accessibilityLabel={`Pay with ${method.label}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                    accessibilityHint={method.description}
                  >
                    <Text style={styles.paymentIcon}>{method.icon}</Text>
                    <View style={styles.paymentInfo}>
                      <Text style={[styles.paymentLabel, isSelected && styles.paymentLabelSelected]}>{method.label}</Text>
                      <Text style={styles.paymentDescription}>{method.description}</Text>
                    </View>
                    {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={
                isProcessing
                  ? t('common.processing')
                  : selectedMethod === 'cash'
                    ? t('checkout.enterCashAmount')
                    : t('checkout.pay', { amount: formatMoney(orderTotal, currency.code) })
              }
              variant="success"
              size="lg"
              fullWidth
              onPress={handleMethodConfirm}
              loading={isProcessing}
              disabled={isProcessing}
            />
            <Button
              title="Split Payment"
              variant="outline"
              size="lg"
              fullWidth
              onPress={() => setStep('split_tender')}
              disabled={isProcessing}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: lightColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    ...elevation.high,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    textAlign: 'center',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lightColors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 18,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lightColors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  content: {
    padding: spacing.md,
  },
  summaryCard: {
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  orderRef: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  totalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.primary,
  },
  loyaltyInfo: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  loyaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  loyaltyIcon: {
    fontSize: typography.fontSize.md,
    marginRight: spacing.xs,
  },
  loyaltyText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.sm,
  },
  paymentMethods: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  paymentOptionSelected: {
    borderColor: lightColors.primary,
    backgroundColor: semanticColors.infoBackground,
  },
  paymentOptionDisabled: {
    opacity: 0.5,
  },
  paymentIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  paymentLabelSelected: {
    color: lightColors.primary,
  },
  paymentDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 20,
    color: lightColors.primary,
    fontWeight: '700',
  },
  actions: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    gap: spacing.sm,
  },
  // ── Cash tendering ──────────────────────────────────────────────────────
  amountDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  amountDueLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  amountDueValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  tenderedDisplay: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    marginBottom: spacing.sm,
  },
  tenderedLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  tenderedValue: {
    fontSize: 40,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  tenderedPlaceholder: {
    color: lightColors.textHint,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  changePositive: {
    backgroundColor: lightColors.success + '20',
  },
  changeInsufficient: {
    backgroundColor: lightColors.error + '15',
  },
  changeLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  changeValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickAmountButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.primary,
    backgroundColor: lightColors.surface,
  },
  quickAmountText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.primary,
  },
  keypadWrapper: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  // ── Split tender ────────────────────────────────────────────────────────
  splitLinesContainer: {
    marginBottom: spacing.sm,
  },
  splitLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  splitLineMethod: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    fontWeight: '500',
  },
  splitLineAmount: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginRight: spacing.sm,
  },
  splitLineRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: lightColors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitLineRemoveText: {
    fontSize: 14,
    color: lightColors.error,
    fontWeight: '700',
  },
  splitTotalsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  splitTotalItem: {
    flex: 1,
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  splitTotalLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  splitTotalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  splitAddSection: {
    marginBottom: spacing.md,
  },
  splitMethodRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  splitMethodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    alignItems: 'center',
  },
  splitMethodButtonSelected: {
    borderColor: lightColors.primary,
    backgroundColor: semanticColors.infoBackground,
  },
  splitMethodButtonText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '500',
  },
  splitMethodButtonTextSelected: {
    color: lightColors.primary,
    fontWeight: '700',
  },
  splitAmountInput: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.surface,
    marginBottom: spacing.sm,
  },
});

export default CheckoutModal;
