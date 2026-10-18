import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../../shared/utils/theme';
import { PaymentResponse } from '../services/PaymentServiceInterface';

interface PaymentResultCardProps {
  result: PaymentResponse;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
}

/** Success/decline card shown after a payment attempt, with a Try Again action on decline. */
export const PaymentResultCard: React.FC<PaymentResultCardProps> = ({ result, retryCount, maxRetries, onRetry }) => (
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
        onPress={onRetry}
        disabled={retryCount >= maxRetries}
        accessibilityLabel="Try payment again"
        accessibilityRole="button"
      >
        <MaterialIcons name="refresh" size={16} color={retryCount >= maxRetries ? lightColors.textDisabled : lightColors.primary} />
        <Text style={[styles.retryButtonText, retryCount >= maxRetries && { color: lightColors.textDisabled }]}>
          Try Again {retryCount > 0 && `(${maxRetries - retryCount} left)`}
        </Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
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
});
