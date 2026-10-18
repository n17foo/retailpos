import React from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { formatMoney, subtractMoney } from '../../../shared/utils/money';
import { interactionStyle } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import PinKeypad from '../../authentication/components/PinKeypad';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { CheckoutModalHeader } from './CheckoutModalHeader';
import { checkoutModalStyles as styles } from './checkoutModalStyles';

interface CashTenderStepProps {
  visible: boolean;
  /** True when tendering a specific split amount rather than the full order total */
  isSplitTender: boolean;
  amountDue: number;
  tenderedStr: string;
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onQuickAmount: (value: number) => void;
  error: string | null;
  isProcessing: boolean;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
}

/** Cash-tender step — amount due, tendered display, change, quick amounts, keypad. */
export const CashTenderStep: React.FC<CashTenderStepProps> = ({
  visible,
  isSplitTender,
  amountDue,
  tenderedStr,
  onKeyPress,
  onDelete,
  onQuickAmount,
  error,
  isProcessing,
  onConfirm,
  onBack,
  onCancel,
}) => {
  const currency = useCurrency();
  const { t } = useTranslate();
  const tenderedAmount = parseFloat(tenderedStr) || 0;
  const changeDue = subtractMoney(tenderedAmount, amountDue);
  const isTenderValid = tenderedAmount >= amountDue;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <CheckoutModalHeader
            title={isSplitTender ? 'Cash Payment (Split)' : t('checkout.cashPayment')}
            onBack={onBack}
            onClose={onCancel}
            disabled={isProcessing}
          />

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
                {isTenderValid
                  ? formatMoney(changeDue, currency.code)
                  : formatMoney(subtractMoney(amountDue, tenderedAmount), currency.code)}
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
                <Pressable
                  key={qa.value}
                  style={state => [styles.quickAmountButton, interactionStyle(state)]}
                  onPress={() => onQuickAmount(qa.value)}
                  accessibilityRole="button"
                  accessibilityLabel={qa.label}
                >
                  <Text style={styles.quickAmountText}>{qa.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Keypad */}
            <View style={styles.keypadWrapper}>
              <PinKeypad onKeyPress={onKeyPress} onDeletePress={onDelete} disableBiometric />
            </View>
          </ScrollView>

          {/* Confirm */}
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
                  : isTenderValid
                    ? isSplitTender
                      ? `Add Cash Payment (Change: ${formatMoney(changeDue, currency.code)})`
                      : t('checkout.confirmCash', { change: formatMoney(changeDue, currency.code) })
                    : t('checkout.enterAmount')
              }
              variant="success"
              size="lg"
              fullWidth
              onPress={onConfirm}
              loading={isProcessing}
              disabled={isProcessing || !isTenderValid}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};
