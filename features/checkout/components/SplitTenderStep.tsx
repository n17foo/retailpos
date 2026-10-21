import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { formatMoney, sumMoney, subtractMoney } from '../../../shared/utils/money';
import { lightColors, interactionStyle } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import type { PaymentLine as OrderPaymentLine } from '../../orders-sync/services/order/order';
import type { PaymentMode } from '../../payments/hooks/usePayment';
import { CheckoutModalHeader } from './CheckoutModalHeader';
import { checkoutModalStyles as styles } from './checkoutModalStyles';
import type { PaymentMethod } from './CheckoutModal';

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

interface SplitTenderStepProps {
  visible: boolean;
  orderTotal: number;
  paymentLines: OrderPaymentLine[];
  splitAmountStr: string;
  onSplitAmountChange: (value: string) => void;
  splitMethod: PaymentMethod;
  onSplitMethodChange: (method: PaymentMethod) => void;
  paymentMode: PaymentMode;
  customerEmail?: string;
  loyaltyPoints: number;
  storeCreditDollars: number;
  error: string | null;
  isProcessing: boolean;
  onAddPaymentLine?: (line: Omit<OrderPaymentLine, 'id' | 'processedAt'>) => void;
  onRemovePaymentLine?: (lineId: string) => void;
  onCompleteSplit?: () => void;
  onBack: () => void;
  onCancel: () => void;
}

/** Split-tender step — collected lines, running totals, add-payment form. */
export const SplitTenderStep: React.FC<SplitTenderStepProps> = ({
  visible,
  orderTotal,
  paymentLines,
  splitAmountStr,
  onSplitAmountChange,
  splitMethod,
  onSplitMethodChange,
  paymentMode,
  customerEmail,
  loyaltyPoints,
  storeCreditDollars,
  error,
  isProcessing,
  onAddPaymentLine,
  onRemovePaymentLine,
  onCompleteSplit,
  onBack,
  onCancel,
}) => {
  const currency = useCurrency();
  const { t } = useTranslate();
  const collected = sumMoney(paymentLines.filter(p => p.amount > 0).map(p => p.amount));
  const remaining = Math.max(0, subtractMoney(orderTotal, collected));
  const splitAmount = parseFloat(splitAmountStr) || 0;
  const isSplitAmountValid = splitAmount > 0 && splitAmount <= remaining + 0.001;
  const isSettled = remaining <= 0.01;

  const handleAddSplitLine = () => {
    if (!isSplitAmountValid || !onAddPaymentLine) return;
    const mappedMethod = splitMethod === 'terminal' ? 'card_terminal' : splitMethod;

    // For cash, the hook will trigger cash tendering
    // For card/terminal, the hook will process payment
    onAddPaymentLine({ method: mappedMethod, amount: splitAmount });
    onSplitAmountChange('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <CheckoutModalHeader title="Split Payment" onBack={onBack} onClose={onCancel} disabled={isProcessing} />

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
                      <Pressable
                        onPress={() => onRemovePaymentLine(line.id)}
                        style={state => [styles.splitLineRemove, interactionStyle(state)]}
                        accessibilityLabel="Remove payment line"
                        accessibilityRole="button"
                      >
                        <Text style={styles.splitLineRemoveText}>✕</Text>
                      </Pressable>
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
                  {(['cash', ...(paymentMode !== 'cash_only' ? ['terminal'] : [])] as PaymentMethod[]).map(m => (
                    <Pressable
                      key={m}
                      style={state => [
                        [styles.splitMethodButton, splitMethod === m && styles.splitMethodButtonSelected],
                        interactionStyle(state),
                      ]}
                      onPress={() => onSplitMethodChange(m)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: splitMethod === m }}
                    >
                      <Text style={[styles.splitMethodButtonText, splitMethod === m && styles.splitMethodButtonTextSelected]}>
                        {methodLabel(m)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {/* Store Credit / Loyalty buttons (only if customer attached and balance available) */}
                {customerEmail && (storeCreditDollars > 0 || loyaltyPoints > 0) && (
                  <View style={styles.splitMethodRow}>
                    {storeCreditDollars > 0 && (
                      <Pressable
                        style={state => [
                          [styles.splitMethodButton, splitMethod === 'store_credit' && styles.splitMethodButtonSelected],
                          interactionStyle(state),
                        ]}
                        onPress={() => onSplitMethodChange('store_credit')}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: splitMethod === 'store_credit' }}
                      >
                        <Text
                          style={[styles.splitMethodButtonText, splitMethod === 'store_credit' && styles.splitMethodButtonTextSelected]}
                        >
                          🎁 Credit ({formatMoney(storeCreditDollars, currency.code)})
                        </Text>
                      </Pressable>
                    )}
                    {loyaltyPoints > 0 && (
                      <Pressable
                        style={state => [
                          [styles.splitMethodButton, splitMethod === 'loyalty' && styles.splitMethodButtonSelected],
                          interactionStyle(state),
                        ]}
                        onPress={() => onSplitMethodChange('loyalty')}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: splitMethod === 'loyalty' }}
                      >
                        <Text style={[styles.splitMethodButtonText, splitMethod === 'loyalty' && styles.splitMethodButtonTextSelected]}>
                          ⭐ Points ({loyaltyPoints})
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
                <TextInput
                  style={styles.splitAmountInput}
                  value={splitAmountStr}
                  onChangeText={onSplitAmountChange}
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
            {error && (
              <Text style={styles.errorBanner} accessibilityRole="alert">
                {error}
              </Text>
            )}
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
};
