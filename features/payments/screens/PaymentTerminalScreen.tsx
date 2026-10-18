import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { usePayment } from '../hooks/usePayment';
import { PaymentResponse } from '../services/PaymentServiceInterface';
import { PaymentProvider } from '../services/PaymentServiceFactory';
import StripeNfcPaymentTerminal from '../components/StripeNfcPaymentTerminal';
import { PaymentResultCard } from '../components/PaymentResultCard';
import { TerminalDiscoveryList, DiscoveredTerminal } from '../components/TerminalDiscoveryList';
import { TerminalChargePanel } from '../components/TerminalChargePanel';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';

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
      orderId?: string;
      customerName?: string;
      onPaymentComplete?: (response: PaymentResponse) => void;
      onCancel?: () => void;
    };
  };
  navigation: { goBack: () => void; navigate: (screen: string) => void };
}

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  [PaymentProvider.STRIPE_NFC]: 'Stripe NFC (Tap to Pay)',
  [PaymentProvider.STRIPE]: 'Stripe Terminal',
  [PaymentProvider.SQUARE]: 'Square',
  [PaymentProvider.ADYEN]: 'Adyen',
  [PaymentProvider.TAP_PAYMENTS]: 'Tap Payments',
  [PaymentProvider.INSTORE_API]: 'Instore PED',
};

const MAX_RETRY_ATTEMPTS = 3;

const PaymentTerminalScreen: React.FC<PaymentTerminalScreenProps> = ({ navigation, route }) => {
  const currency = useCurrency();
  const routeParams = route?.params ?? {};
  const amount = routeParams.amount ?? 0;
  const items = routeParams.items ?? [];
  const onPaymentComplete = routeParams.onPaymentComplete ?? (() => navigation.goBack());
  const onCancel = routeParams.onCancel ?? (() => navigation.goBack());

  const { connectToTerminal, processPayment, disconnect, isTerminalConnected, getAvailableTerminals, getCurrentProvider } = usePayment();

  const currentProvider = getCurrentProvider();
  const isStripeNfcActive = currentProvider === PaymentProvider.STRIPE_NFC;
  const providerLabel = PROVIDER_LABELS[currentProvider] ?? currentProvider;

  const [availableTerminals, setAvailableTerminals] = useState<DiscoveredTerminal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [selectedTerminalName, setSelectedTerminalName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Discover real terminals from the active payment provider
  const handleScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setAvailableTerminals([]);
    try {
      const terminals = await getAvailableTerminals();
      setAvailableTerminals(terminals);
      if (terminals.length === 0) {
        setError(`No ${providerLabel} terminals found. Make sure your terminal is powered on and nearby.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan for terminals.');
    } finally {
      setScanning(false);
    }
  }, [getAvailableTerminals, providerLabel]);

  // Auto-scan on mount (not needed for Stripe NFC which has its own UI)
  useEffect(() => {
    if (!isStripeNfcActive) {
      handleScan();
    }
  }, [handleScan, isStripeNfcActive]);

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
      if (isTerminalConnected()) {
        disconnect();
      }
    };
  }, [disconnect, isTerminalConnected]);

  const handleConnect = async (terminalId: string, terminalName: string) => {
    setConnecting(true);
    setSelectedTerminal(terminalId);
    setSelectedTerminalName(terminalName);
    setError(null);
    try {
      const success = await connectToTerminal(terminalId);
      if (success) {
        setConnected(true);
      } else {
        setError(`Could not connect to "${terminalName}". Check the terminal is ready and try again.`);
        setSelectedTerminal(null);
        setSelectedTerminalName(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed.');
      setSelectedTerminal(null);
      setSelectedTerminalName(null);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setConnected(false);
    setSelectedTerminal(null);
    setSelectedTerminalName(null);
    setResult(null);
    setError(null);
    setRetryCount(0);
  };

  const handleProcessPayment = async () => {
    if (!connected || !selectedTerminal) return;

    // Check retry limit
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      setError(`Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) reached. Please disconnect and try again.`);
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);
    setRetryCount(prev => prev + 1);

    const PAYMENT_TIMEOUT = 60000; // 60 seconds
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Payment timeout - please try again')), PAYMENT_TIMEOUT);
      });

      const response = await Promise.race([
        processPayment({
          amount,
          reference: `ORDER-${Date.now()}`,
          currency: currency.code,
          orderId: routeParams.orderId,
          customerName: routeParams.customerName,
          items: items.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        }),
        timeoutPromise,
      ]);

      setResult(response);
      if (response.success) {
        setRetryCount(0); // Reset on success
        completionTimerRef.current = setTimeout(() => onPaymentComplete(response), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setProcessing(false);
    }
  };

  // Stripe NFC has its own dedicated UI component
  if (isStripeNfcActive) {
    return (
      <StripeNfcPaymentTerminal
        amount={amount}
        items={items}
        orderId={routeParams.orderId}
        customerName={routeParams.customerName}
        onPaymentComplete={onPaymentComplete}
        onCancel={onCancel}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, processing && styles.backButtonDisabled]}
          onPress={onCancel}
          disabled={processing}
          accessibilityLabel="Cancel and go back"
          accessibilityRole="button"
        >
          <MaterialIcons name="arrow-back" size={24} color={processing ? lightColors.textDisabled : lightColors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>Payment Terminal</Text>
          <Text style={styles.providerLabel}>{providerLabel}</Text>
        </View>
        {connected && (
          <View style={styles.connectedBadge}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedBadgeText}>Connected</Text>
          </View>
        )}
      </View>

      {/* Amount card — only shown when a real amount is passed */}
      {amount > 0 && (
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Amount to collect</Text>
          <Text style={styles.amount}>{formatMoney(amount, currency.code)}</Text>
          {routeParams.customerName ? <Text style={styles.customerName}>{routeParams.customerName}</Text> : null}
        </View>
      )}

      {/* Inline error banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color={lightColors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={16} color={lightColors.error} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Result card */}
      {result ? (
        <PaymentResultCard
          result={result}
          retryCount={retryCount}
          maxRetries={MAX_RETRY_ATTEMPTS}
          onRetry={() => {
            setResult(null);
            setError(null);
          }}
        />
      ) : null}

      {/* Terminal discovery list */}
      {!result && !connected ? (
        <TerminalDiscoveryList
          providerLabel={providerLabel}
          terminals={availableTerminals}
          scanning={scanning}
          connecting={connecting}
          connectingTerminalId={selectedTerminal}
          hasError={!!error}
          onScan={handleScan}
          onConnect={handleConnect}
        />
      ) : null}

      {/* Connected — ready to charge */}
      {!result && connected ? (
        <TerminalChargePanel
          terminalName={selectedTerminalName}
          processing={processing}
          amount={amount}
          currencyCode={currency.code}
          onDisconnect={handleDisconnect}
          onCharge={handleProcessPayment}
        />
      ) : null}

      {/* Cancel footer — hidden while processing or showing result */}
      {!processing && !result ? (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel} accessibilityLabel="Cancel payment" accessibilityRole="button">
            <MaterialIcons name="close" size={18} color={lightColors.error} />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  // ── Header ──────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonDisabled: {
    opacity: 0.4,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
    lineHeight: 20,
  },
  providerLabel: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: 1,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: lightColors.success,
  },
  connectedBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: lightColors.success,
  },
  // ── Amount card ──────────────────────────────────────────────────────
  amountContainer: {
    backgroundColor: lightColors.surface,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...elevation.low,
  },
  amountLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  amount: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginTop: spacing.xs,
  },
  customerName: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: spacing.xs,
  },
  // ── Error banner ─────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    backgroundColor: lightColors.error + '15',
    borderRadius: borderRadius.sm,
  },
  errorText: {
    flex: 1,
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
  },
  // ── Footer ───────────────────────────────────────────────────────────
  footer: {
    padding: spacing.md,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: lightColors.error,
    padding: spacing.md - 2,
    borderRadius: borderRadius.md,
  },
  cancelButtonText: {
    color: lightColors.error,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
});

export default PaymentTerminalScreen;
