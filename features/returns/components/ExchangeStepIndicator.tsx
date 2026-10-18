import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { lightColors, spacing, typography } from '../../../shared/utils/theme';

export type ExchangeStep = 'select_returns' | 'add_items' | 'settle';

const STEPS: ExchangeStep[] = ['select_returns', 'add_items', 'settle'];
const STEP_LABELS: Record<ExchangeStep, string> = {
  select_returns: 'Returns',
  add_items: 'New Items',
  settle: 'Settle',
};

interface ExchangeStepIndicatorProps {
  step: ExchangeStep;
}

/** Numbered dot indicator for the three-step exchange flow. */
export const ExchangeStepIndicator: React.FC<ExchangeStepIndicatorProps> = ({ step }) => (
  <View style={styles.stepIndicator}>
    {STEPS.map((s, i) => (
      <View key={s} style={styles.stepItem}>
        <View style={[styles.stepDot, step === s && styles.stepDotActive, i < STEPS.indexOf(step) && styles.stepDotDone]}>
          <Text style={styles.stepDotText}>{i + 1}</Text>
        </View>
        <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>{STEP_LABELS[s]}</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    gap: spacing.xl,
  },
  stepItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: lightColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: lightColors.primary,
  },
  stepDotDone: {
    backgroundColor: lightColors.success,
  },
  stepDotText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: lightColors.surface,
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  stepLabelActive: {
    color: lightColors.primary,
    fontWeight: '600',
  },
});
