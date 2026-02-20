import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { formatMoney } from '../utils/money';
import { usePayment } from '../hooks/usePayment';
import { PaymentResponse } from '../services/payment/PaymentServiceInterface';
import { PaymentProvider } from '../services/payment/PaymentServiceFactory';
import StripeNfcPaymentTerminal from '../components/StripeNfcPaymentTerminal';
import { useCurrency } from '../hooks/useCurrency';

interface PaymentTerminalScreenProps {
  route?: {
    params?: {
      amount?: number;
      items?: Array<{
        id: string;
        name: string;
        price: number;
        quantity: number;
      }>;
      // Added optional fields for enhanced Stripe NFC tap to pay
      orderId?: string;
      customerName?: string;
      onPaymentComplete?: (response: PaymentResponse) => void;
      onCancel?: () => void;
    };
  };
  navigation: { goBack: () => void; navigate: (screen: string) => void };
}

// Mock terminal device IDs
const AVAILABLE_TERMINALS = [
  { id: 'TERM-001', name: 'Main Counter' },
  { id: 'TERM-002', name: 'Register 2' },
  { id: 'TERM-003', name: 'Mobile POS' },
];

const PaymentTerminalScreen: React.FC<PaymentTerminalScreenProps> = ({ navigation, route }) => {
  const currency = useCurrency();
  // Handle optional route params with defaults for demo mode
  const routeParams = route?.params || {};
  const amount = routeParams.amount || 25.99; // Demo amount
  const items = routeParams.items || [{ id: 'demo-1', name: 'Demo Item', price: 25.99, quantity: 1 }];
  const onPaymentComplete =
    routeParams.onPaymentComplete ||
    ((response: PaymentResponse) => {
      Alert.alert('Demo Payment Complete', `Transaction: ${response.transactionId}`);
    });
  const onCancel = routeParams.onCancel || (() => navigation.goBack());

  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<PaymentResponse | null>(null);
  const { connectToTerminal, processPayment, disconnect, isTerminalConnected, getCurrentProvider } = usePayment();

  // Check if Stripe NFC is the active payment provider
  const isStripeNfcActive = getCurrentProvider() === PaymentProvider.STRIPE_NFC;

  // Connect to selected terminal
  const handleConnect = async (terminalId: string) => {
    setConnecting(true);
    setSelectedTerminal(terminalId);

    try {
      const success = await connectToTerminal(terminalId);
      setConnected(success);
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to payment terminal');
    } finally {
      setConnecting(false);
    }
  };

  // Process payment on connected terminal
  const handleProcessPayment = async () => {
    if (!connected || !selectedTerminal) {
      Alert.alert('Not Connected', 'Please connect to a payment terminal first');
      return;
    }

    setProcessing(true);

    try {
      const response = await processPayment({
        amount,
        reference: `ORDER-${Date.now()}`,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      });

      setResult(response);

      if (response.success) {
        Alert.alert('Payment Successful', `Transaction ID: ${response.transactionId}\nReceipt: ${response.receiptNumber}`, [
          { text: 'OK', onPress: () => onPaymentComplete(response) },
        ]);
      } else {
        Alert.alert('Payment Failed', response.errorMessage || 'Unknown error occurred', [
          { text: 'Try Again' },
          { text: 'Cancel', onPress: onCancel },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  // Clean up: disconnect from terminal when leaving screen
  useEffect(() => {
    return () => {
      if (isTerminalConnected()) {
        disconnect();
      }
    };
  }, []);

  // If Stripe NFC is active, use our specialized component with enhanced UI for tap-to-pay flow
  if (isStripeNfcActive) {
    return (
      <StripeNfcPaymentTerminal
        amount={amount}
        items={items}
        orderId={routeParams.orderId} // Pass through if available
        customerName={routeParams.customerName} // Pass through if available
        onPaymentComplete={onPaymentComplete}
        onCancel={onCancel}
      />
    );
  }

  // For all other payment providers, use the standard UI
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Terminal</Text>
      {!routeParams.amount && <Text style={styles.subtitle}>Demo Mode - Test payment terminal connections</Text>}

      <View style={styles.amountContainer}>
        <Text style={styles.amountLabel}>Total Amount:</Text>
        <Text style={styles.amount}>{formatMoney(amount, currency.code)}</Text>
      </View>

      {!connected ? (
        <View style={styles.terminalSelector}>
          <Text style={styles.sectionTitle}>Select Payment Terminal:</Text>
          <ScrollView>
            {AVAILABLE_TERMINALS.map(terminal => (
              <TouchableOpacity
                key={terminal.id}
                style={[styles.terminalButton, selectedTerminal === terminal.id && styles.selectedTerminal]}
                onPress={() => handleConnect(terminal.id)}
                disabled={connecting}
              >
                <Text style={styles.terminalButtonText}>{terminal.name}</Text>
                {connecting && selectedTerminal === terminal.id && <ActivityIndicator size="small" color="#ffffff" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.processingContainer}>
          <Text style={styles.connectedText}>Connected to: {AVAILABLE_TERMINALS.find(t => t.id === selectedTerminal)?.name}</Text>

          {processing ? (
            <View style={styles.processingIndicator}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.processingText}>Processing payment...</Text>
              <Text style={styles.processingSubtext}>Please wait</Text>
            </View>
          ) : !result ? (
            <TouchableOpacity style={styles.payButton} onPress={handleProcessPayment}>
              <Text style={styles.payButtonText}>Process Payment</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={processing}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
    padding: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  amountContainer: {
    backgroundColor: lightColors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...elevation.low,
  },
  amountLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  amount: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: lightColors.textSecondary,
  },
  terminalSelector: {
    flex: 1,
    marginBottom: spacing.md,
  },
  terminalButton: {
    backgroundColor: lightColors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedTerminal: {
    backgroundColor: lightColors.primaryDark,
  },
  terminalButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedText: {
    fontSize: typography.fontSize.md,
    color: lightColors.success,
    marginBottom: spacing.lg,
  },
  payButton: {
    backgroundColor: lightColors.success,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  payButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  processingIndicator: {
    alignItems: 'center',
  },
  processingText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '500',
    marginTop: spacing.lg,
  },
  processingSubtext: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: spacing.xs,
  },
  footer: {
    marginTop: spacing.lg,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: lightColors.error,
    padding: spacing.md - 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: lightColors.error,
    fontSize: typography.fontSize.md,
  },
});

export default PaymentTerminalScreen;
