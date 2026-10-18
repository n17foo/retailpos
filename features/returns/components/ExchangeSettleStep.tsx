import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { Button } from '../../../shared/components/Button';
import { PaymentMethod } from '../../orders-sync/services/order/order';
import { ExchangeSession } from '../services/exchange/ExchangeService';
import { exchangeStyles as styles } from './exchangeStyles';

const METHOD_LABELS: Record<string, string> = {
  cash: '💵 Cash',
  card: '💳 Card',
  card_terminal: '📱 Terminal',
  store_credit: '🏷️ Store Credit',
  other: '🔄 Other',
};

interface ExchangeSettleStepProps {
  session: ExchangeSession;
  currencyCode: string;
  settleMethod: PaymentMethod;
  settleAmountStr: string;
  isProcessing: boolean;
  onMethodChange: (method: PaymentMethod) => void;
  onAmountChange: (amount: string) => void;
  onAddPayment: () => void;
  onRemovePayment: (paymentId: string) => void;
  onComplete: () => void;
}

/** Step 3 — settle the net balance (collect payments / confirm refund) and complete. */
export const ExchangeSettleStep: React.FC<ExchangeSettleStepProps> = ({
  session,
  currencyCode,
  settleMethod,
  settleAmountStr,
  isProcessing,
  onMethodChange,
  onAmountChange,
  onAddPayment,
  onRemovePayment,
  onComplete,
}) => (
  <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
    {/* Summary */}
    <View style={styles.settleSummary}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Return credit</Text>
        <Text style={[styles.summaryValue, { color: lightColors.success }]}>−{formatMoney(session.returnCredit, currencyCode)}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>New items total</Text>
        <Text style={styles.summaryValue}>{formatMoney(session.newItemsTotal, currencyCode)}</Text>
      </View>
      <View style={[styles.summaryRow, styles.summaryTotal]}>
        <Text style={styles.summaryTotalLabel}>{session.netDue >= 0 ? 'Net due' : 'Refund due'}</Text>
        <Text style={[styles.summaryTotalValue, { color: session.netDue >= 0 ? lightColors.textPrimary : lightColors.success }]}>
          {formatMoney(Math.abs(session.netDue), currencyCode)}
        </Text>
      </View>
    </View>

    {/* Collected payments */}
    {session.payments.length > 0 && (
      <View style={styles.paymentsSection}>
        <Text style={styles.sectionTitle}>Payments collected</Text>
        {session.payments.map(p => (
          <View key={p.id} style={styles.paymentLine}>
            <Text style={styles.paymentLineMethod}>{METHOD_LABELS[p.method] ?? p.method}</Text>
            <Text style={styles.paymentLineAmount}>{formatMoney(p.amount, currencyCode)}</Text>
            <TouchableOpacity
              onPress={() => onRemovePayment(p.id)}
              style={styles.removeButton}
              accessibilityLabel="Remove payment"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={18} color={lightColors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    )}

    {/* Remaining */}
    <View
      style={[
        styles.remainingRow,
        { backgroundColor: session.remainingDue <= 0.01 ? lightColors.success + '20' : lightColors.error + '15' },
      ]}
    >
      <Text style={styles.remainingLabel}>Remaining</Text>
      <Text style={[styles.remainingValue, { color: session.remainingDue <= 0.01 ? lightColors.success : lightColors.error }]}>
        {formatMoney(Math.max(0, session.remainingDue), currencyCode)}
      </Text>
    </View>

    {/* Add payment */}
    {session.remainingDue > 0.01 && (
      <View style={styles.addPaymentSection}>
        <Text style={styles.sectionTitle}>Add payment</Text>
        <View style={styles.methodRow}>
          {(['cash', 'card', 'card_terminal', 'store_credit', 'other'] as PaymentMethod[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.methodButton, settleMethod === m && styles.methodButtonSelected]}
              onPress={() => onMethodChange(m)}
              accessibilityRole="radio"
              accessibilityState={{ selected: settleMethod === m }}
            >
              <Text style={[styles.methodButtonText, settleMethod === m && styles.methodButtonTextSelected]}>{METHOD_LABELS[m] ?? m}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.amountInput}
          value={settleAmountStr}
          onChangeText={onAmountChange}
          placeholder={`Amount (max ${formatMoney(session.remainingDue, currencyCode)})`}
          keyboardType="decimal-pad"
          accessibilityLabel="Payment amount"
        />
        <Button title="Add Payment" variant="primary" fullWidth onPress={onAddPayment} disabled={!settleAmountStr || isProcessing} />
      </View>
    )}

    <View style={styles.footer}>
      <Button
        title={isProcessing ? 'Processing…' : 'Complete Exchange'}
        variant="success"
        size="lg"
        fullWidth
        onPress={onComplete}
        loading={isProcessing}
        disabled={isProcessing || session.remainingDue > 0.01}
      />
    </View>
  </ScrollView>
);
