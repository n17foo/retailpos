import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
      orderId?: string;
      customerName?: string;
      onPaymentComplete?: (response: PaymentResponse) => void;
      onCancel?: () => void;
    };
  };
  navigation: { goBack: () => void; navigate: (screen: string) => void };
}

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  [PaymentProvider.WORLDPAY]: 'Worldpay',
  [PaymentProvider.STRIPE]: 'Stripe Terminal',
  [PaymentProvider.STRIPE_NFC]: 'Stripe NFC',
  [PaymentProvider.SQUARE]: 'Square',
};

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

  const [availableTerminals, setAvailableTerminals] = useState<Array<{ id: string; name: string }>>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [selectedTerminalName, setSelectedTerminalName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      if (isTerminalConnected()) {
        disconnect();
      }
    };
  }, []);

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
  };

  const handleProcessPayment = async () => {
    if (!connected || !selectedTerminal) return;
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const response = await processPayment({
        amount,
        reference: `ORDER-${Date.now()}`,
        orderId: routeParams.orderId,
        customerName: routeParams.customerName,
        items: items.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      });
      setResult(response);
      if (response.success) {
        setTimeout(() => onPaymentComplete(response), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
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
          style={styles.backButton}
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
        <View style={[styles.resultCard, result.success ? styles.resultSuccess : styles.resultFailure]}>
          <MaterialIcons
            name={result.success ? 'check-circle' : 'cancel'}
            size={40}
            color={result.success ? lightColors.success : lightColors.error}
          />
          <Text style={[styles.resultTitle, { color: result.success ? lightColors.success : lightColors.error }]}>
            {result.success ? 'Payment Accepted' : 'Payment Declined'}
          </Text>
          {result.success && result.transactionId ? <Text style={styles.resultMeta}>Ref: {result.transactionId.slice(-12)}</Text> : null}
          {result.success && result.cardBrand && result.last4 ? (
            <Text style={styles.resultMeta}>
              {result.cardBrand} ···· {result.last4}
            </Text>
          ) : null}
          {!result.success && result.errorMessage ? <Text style={styles.resultMeta}>{result.errorMessage}</Text> : null}
          {!result.success ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setResult(null);
                setError(null);
              }}
              accessibilityLabel="Try payment again"
              accessibilityRole="button"
            >
              <MaterialIcons name="refresh" size={16} color={lightColors.primary} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Terminal discovery list */}
      {!result && !connected ? (
        <View style={styles.terminalSelector}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{scanning ? 'Scanning for terminals…' : `${providerLabel} Terminals`}</Text>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleScan}
              disabled={scanning || connecting}
              accessibilityLabel="Scan for terminals"
              accessibilityRole="button"
            >
              {scanning ? (
                <ActivityIndicator size="small" color={lightColors.primary} />
              ) : (
                <MaterialIcons name="refresh" size={20} color={lightColors.primary} />
              )}
            </TouchableOpacity>
          </View>

          {!scanning && availableTerminals.length === 0 && !error ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="point-of-sale" size={48} color={lightColors.textDisabled} />
              <Text style={styles.emptyStateText}>No terminals found</Text>
              <Text style={styles.emptyStateHint}>Tap refresh to scan again</Text>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>
            {availableTerminals.map(terminal => {
              const isConnecting = connecting && selectedTerminal === terminal.id;
              return (
                <TouchableOpacity
                  key={terminal.id}
                  style={[styles.terminalButton, isConnecting && styles.terminalButtonActive]}
                  onPress={() => handleConnect(terminal.id, terminal.name)}
                  disabled={connecting}
                  accessibilityLabel={`Connect to ${terminal.name}`}
                  accessibilityRole="button"
                >
                  <MaterialIcons name="point-of-sale" size={22} color={lightColors.textOnPrimary} />
                  <View style={styles.terminalInfo}>
                    <Text style={styles.terminalButtonText}>{terminal.name}</Text>
                    <Text style={styles.terminalId}>{terminal.id}</Text>
                  </View>
                  {isConnecting ? (
                    <ActivityIndicator size="small" color={lightColors.textOnPrimary} />
                  ) : (
                    <MaterialIcons name="chevron-right" size={22} color={lightColors.textOnPrimary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Connected — ready to charge */}
      {!result && connected ? (
        <View style={styles.processingContainer}>
          <View style={styles.connectedTerminalRow}>
            <MaterialIcons name="check-circle" size={22} color={lightColors.success} />
            <Text style={styles.connectedText}>{selectedTerminalName}</Text>
            <TouchableOpacity
              onPress={handleDisconnect}
              style={styles.disconnectButton}
              accessibilityLabel="Disconnect terminal"
              accessibilityRole="button"
            >
              <MaterialIcons name="link-off" size={18} color={lightColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {processing ? (
            <View style={styles.processingIndicator}>
              <ActivityIndicator size="large" color={lightColors.primary} />
              <Text style={styles.processingText}>Processing payment…</Text>
              <Text style={styles.processingSubtext}>Present card to terminal</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.payButton}
              onPress={handleProcessPayment}
              accessibilityLabel={amount > 0 ? `Charge ${formatMoney(amount, currency.code)}` : 'Process payment'}
              accessibilityRole="button"
            >
              <MaterialIcons name="payment" size={22} color={lightColors.textOnPrimary} />
              <Text style={styles.payButtonText}>{amount > 0 ? `Charge ${formatMoney(amount, currency.code)}` : 'Process Payment'}</Text>
            </TouchableOpacity>
          )}
        </View>
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
  // ── Result card ──────────────────────────────────────────────────────
  resultCard: {
    margin: spacing.md,
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    gap: spacing.sm,
    ...elevation.low,
  },
  resultSuccess: {
    backgroundColor: lightColors.success + '10',
    borderWidth: 1,
    borderColor: lightColors.success + '40',
  },
  resultFailure: {
    backgroundColor: lightColors.error + '10',
    borderWidth: 1,
    borderColor: lightColors.error + '40',
  },
  resultTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
  },
  resultMeta: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: lightColors.primary,
    borderRadius: borderRadius.sm,
  },
  retryButtonText: {
    color: lightColors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  // ── Terminal selector ────────────────────────────────────────────────
  terminalSelector: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textSecondary,
  },
  scanButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textSecondary,
  },
  emptyStateHint: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textDisabled,
  },
  terminalButton: {
    backgroundColor: lightColors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  terminalButtonActive: {
    backgroundColor: lightColors.primaryDark,
  },
  terminalInfo: {
    flex: 1,
  },
  terminalButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
  },
  terminalId: {
    color: lightColors.textOnPrimary + 'AA',
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  // ── Connected / processing ───────────────────────────────────────────
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  connectedTerminalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  connectedText: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.success,
    fontWeight: '600',
  },
  disconnectButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButton: {
    backgroundColor: lightColors.success,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  payButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  processingIndicator: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  processingText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '500',
    color: lightColors.textPrimary,
    marginTop: spacing.sm,
  },
  processingSubtext: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
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
