import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { lightColors, spacing, typography } from '../utils/theme';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentStep, totalSteps, labels }) => {
  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <View key={i} style={styles.stepContainer}>
              <View style={[styles.dot, isCompleted && styles.dotCompleted, isCurrent && styles.dotCurrent]}>
                {isCompleted ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : (
                  <Text style={[styles.dotNumber, isCurrent && styles.dotNumberCurrent]}>{stepNum}</Text>
                )}
              </View>
              {i < totalSteps - 1 && <View style={[styles.connector, isCompleted && styles.connectorCompleted]} />}
            </View>
          );
        })}
      </View>
      {labels && labels[currentStep - 1] && (
        <Text style={styles.label}>
          Step {currentStep} of {totalSteps}: {labels[currentStep - 1]}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: lightColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    backgroundColor: lightColors.success,
  },
  dotCurrent: {
    backgroundColor: lightColors.primary,
  },
  dotNumber: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: lightColors.textSecondary,
  },
  dotNumberCurrent: {
    color: lightColors.textOnPrimary,
  },
  checkmark: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textOnPrimary,
    fontWeight: '700',
  },
  connector: {
    width: 20,
    height: 2,
    backgroundColor: lightColors.border,
  },
  connectorCompleted: {
    backgroundColor: lightColors.success,
  },
  label: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
});

export default ProgressIndicator;
