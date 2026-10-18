import React from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { formatMoney } from '../../../shared/utils/money';
import { interactionStyle } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import type { PaymentMode } from '../../payments/hooks/usePayment';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import { CheckoutModalHeader } from './CheckoutModalHeader';
import { checkoutModalStyles as styles } from './checkoutModalStyles';
import type { PaymentMethod } from './CheckoutModal';

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

interface MethodSelectStepProps {
  visible: boolean;
  orderId: string;
  orderTotal: number;
  orderSubtotal: number;
  orderTax: number;
  itemCount: number;
  selectedMethod: PaymentMethod;
  onSelectMethod: (method: PaymentMethod) => void;
  terminalConnected: boolean;
  paymentMode: PaymentMode;
  activeProvider?: PaymentProvider;
  customerEmail?: string;
  loyaltyPoints: number;
  storeCreditDollars: number;
  error: string | null;
  isProcessing: boolean;
  onConfirm: () => void;
  onSplit: () => void;
  onCancel: () => void;
}

/** Method-selection step — order summary card plus payment method radio list. */
export const MethodSelectStep: React.FC<MethodSelectStepProps> = ({
  visible,
  orderId,
  orderTotal,
  orderSubtotal,
  orderTax,
  itemCount,
  selectedMethod,
  onSelectMethod,
  terminalConnected,
  paymentMode,
  activeProvider,
  customerEmail,
  loyaltyPoints,
  storeCreditDollars,
  error,
  isProcessing,
  onConfirm,
  onSplit,
  onCancel,
}) => {
  const currency = useCurrency();
  const { t } = useTranslate();
  const availableMethods = buildMethodList(paymentMode, activeProvider, terminalConnected);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <CheckoutModalHeader title={t('checkout.completeOrder')} onClose={onCancel} disabled={isProcessing} />

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
                  <Pressable
                    key={method.id}
                    style={state => [
                      [styles.paymentOption, isSelected && styles.paymentOptionSelected, isDisabled && styles.paymentOptionDisabled],
                      interactionStyle(state),
                    ]}
                    onPress={() => !isDisabled && onSelectMethod(method.id)}
                    disabled={isDisabled}
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
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            {error && (
              <Text style={styles.errorBanner} accessibilityRole="alert">
                {error}
              </Text>
            )}
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
              onPress={onConfirm}
              loading={isProcessing}
              disabled={isProcessing}
            />
            <Button title="Split Payment" variant="outline" size="lg" fullWidth onPress={onSplit} disabled={isProcessing} />
          </View>
        </View>
      </View>
    </Modal>
  );
};
