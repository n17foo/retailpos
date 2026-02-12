import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Animated, Easing } from 'react-native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { formatMoney } from '../utils/money';
import { usePayment } from '../hooks/usePayment';
import { PaymentResponse } from '../services/payment/paymentServiceInterface';
import { PaymentProvider } from '../services/payment/paymentServiceFactory';
import { useCurrency } from '../hooks/useCurrency';

interface StripeNfcPaymentTerminalProps {
  amount: number;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  orderId?: string;
  customerName?: string;
  onPaymentComplete: (response: PaymentResponse) => void;
  onCancel: () => void;
}

/**
 * Specialized component for handling Stripe NFC Tap to Pay workflow
 * This provides a better UX for contactless payments with visual cues
 */
const StripeNfcPaymentTerminal: React.FC<StripeNfcPaymentTerminalProps> = ({
  amount,
  items,
  orderId,
  customerName,
  onPaymentComplete,
  onCancel,
}) => {
  const currency = useCurrency();
  // Animation value for the tap animation
  const tapAnimation = new Animated.Value(1);

  // States
  const [connecting, setConnecting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>('ready');
  const [cardType, setCardType] = useState<string | null>(null);

  // Get payment services from hook
  const { processPayment, disconnect, isTerminalConnected, getConnectedDeviceId, getCurrentProvider } = usePayment();

  // Check if we're using Stripe NFC
  const isStripeNfc = getCurrentProvider() === PaymentProvider.STRIPE_NFC;

  // Start the tap animation
  useEffect(() => {
    if (paymentStatus === 'waiting_for_tap') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(tapAnimation, {
            toValue: 1.2,
            duration: 800,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(tapAnimation, {
            toValue: 1,
            duration: 800,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      tapAnimation.stopAnimation();
      tapAnimation.setValue(1);
    }
  }, [paymentStatus]);

  // Process payment
  const handlePayment = async () => {
    setProcessing(true);
    setPaymentStatus('connecting');
    setError(null);

    try {
      // Check if terminal is connected or initiate connection if needed
      const terminalId = getConnectedDeviceId();
      if (!terminalId) {
        setPaymentStatus('connecting_to_terminal');
      }

      // After connection, update status
      setPaymentStatus('waiting_for_tap');

      // Build payment request with rich metadata
      const response = await processPayment({
        amount,
        reference: `ORDER-${Date.now()}`,
        currency: 'usd',
        orderId: orderId || `ORD-${Date.now().toString().slice(-8)}`,
        customerName: customerName || '',
        itemCount: items.length,
        items: items.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      });

      // Process response
      if (response.success) {
        setPaymentStatus('approved');
        setCardType(response.cardBrand || null);

        // Short delay to show success state before completing
        setTimeout(() => {
          onPaymentComplete(response);
        }, 1500);
      } else {
        setPaymentStatus('declined');
        setError(response.errorMessage || 'Payment was declined');

        // If error is connection related, provide option to retry
        if (response.errorCode === 'connection_error') {
          setPaymentStatus('connection_error');
        } else if (response.errorCode === 'card_declined') {
          setPaymentStatus('card_declined');
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      setPaymentStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown payment error occurred');
    } finally {
      setProcessing(false);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (isTerminalConnected()) {
        disconnect();
      }
    };
  }, []);

  // Show payment instructions based on status
  const renderPaymentInstructions = () => {
    switch (paymentStatus) {
      case 'ready':
        return (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionTitle}>Ready to Process Payment</Text>
            <Text style={styles.instructionText}>Click "Process Payment" to start the contactless payment flow</Text>
          </View>
        );

      case 'connecting':
      case 'connecting_to_terminal':
        return (
          <View style={styles.instructionsContainer}>
            <ActivityIndicator size="large" color="#0066cc" />
            <Text style={styles.instructionTitle}>Connecting to Terminal</Text>
            <Text style={styles.instructionText}>Please wait while we connect to your payment terminal</Text>
          </View>
        );

      case 'waiting_for_tap':
        return (
          <View style={styles.instructionsContainer}>
            <Animated.View style={[styles.tapAnimationContainer, { transform: [{ scale: tapAnimation }] }]}>
              <Image source={require('../assets/tap-to-pay.png')} style={styles.tapIcon} resizeMode="contain" />
            </Animated.View>
            <Text style={styles.instructionTitle}>Tap to Pay</Text>
            <Text style={styles.instructionText}>Please tap your card, phone, or watch to the terminal</Text>
          </View>
        );

      case 'processing':
        return (
          <View style={styles.instructionsContainer}>
            <ActivityIndicator size="large" color="#0066cc" />
            <Text style={styles.instructionTitle}>Processing Payment</Text>
            <Text style={styles.instructionText}>Please keep your card/device near the terminal</Text>
          </View>
        );

      case 'approved':
        return (
          <View style={styles.instructionsContainer}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.instructionTitle}>Payment Approved</Text>
            {cardType && <Text style={styles.cardTypeText}>{cardType} ••••</Text>}
          </View>
        );

      case 'declined':
      case 'card_declined':
        return (
          <View style={styles.instructionsContainer}>
            <View style={styles.errorIconContainer}>
              <Text style={styles.errorIcon}>✕</Text>
            </View>
            <Text style={styles.instructionTitle}>Payment Declined</Text>
            <Text style={styles.errorText}>{error || 'Card was declined'}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handlePayment}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        );

      case 'connection_error':
        return (
          <View style={styles.instructionsContainer}>
            <View style={styles.errorIconContainer}>
              <Text style={styles.errorIcon}>!</Text>
            </View>
            <Text style={styles.instructionTitle}>Connection Error</Text>
            <Text style={styles.errorText}>{error || 'Could not connect to payment terminal'}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handlePayment}>
              <Text style={styles.retryButtonText}>Reconnect & Try Again</Text>
            </TouchableOpacity>
          </View>
        );

      case 'error':
      default:
        return (
          <View style={styles.instructionsContainer}>
            <View style={styles.errorIconContainer}>
              <Text style={styles.errorIcon}>!</Text>
            </View>
            <Text style={styles.instructionTitle}>Payment Error</Text>
            <Text style={styles.errorText}>{error || 'An unknown error occurred'}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handlePayment}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contactless Payment</Text>

      <View style={styles.amountContainer}>
        <Text style={styles.amountLabel}>Total Amount:</Text>
        <Text style={styles.amount}>{formatMoney(amount, currency.code)}</Text>
      </View>

      {renderPaymentInstructions()}

      {paymentStatus === 'ready' && (
        <TouchableOpacity style={styles.payButton} onPress={handlePayment} disabled={processing}>
          <Text style={styles.payButtonText}>Process Payment</Text>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={processing || paymentStatus === 'approved'}>
          <Text style={[styles.cancelButtonText, (processing || paymentStatus === 'approved') && styles.disabledText]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: lightColors.background,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  amountContainer: {
    backgroundColor: lightColors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...elevation.medium,
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
  instructionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  instructionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    marginVertical: spacing.md,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  tapAnimationContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapIcon: {
    width: 100,
    height: 100,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.round,
    backgroundColor: lightColors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successIcon: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.xxxl,
    fontWeight: '700',
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.round,
    backgroundColor: lightColors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  errorIcon: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.xxxl,
    fontWeight: '700',
  },
  errorText: {
    color: lightColors.error,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  cardTypeText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginTop: spacing.xs,
  },
  retryButton: {
    backgroundColor: lightColors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  retryButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
  payButton: {
    backgroundColor: lightColors.success,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  payButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  footer: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: lightColors.error,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: lightColors.error,
    fontSize: typography.fontSize.md,
  },
  disabledText: {
    color: lightColors.textDisabled,
    borderColor: lightColors.textDisabled,
  },
});

export default StripeNfcPaymentTerminal;
