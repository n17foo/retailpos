import React from 'react';
import { View, StyleSheet } from 'react-native';
import { lightColors, borderRadius, spacing } from '../utils/theme';

interface PinDisplayProps {
  pinLength: number;
  filledCount: number;
}

/**
 * Visual indicator for PIN entry progress
 * Shows dots for each PIN digit (filled or empty)
 */
const PinDisplay: React.FC<PinDisplayProps> = ({ pinLength, filledCount }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: pinLength }).map((_, index) => (
        <View key={index} style={[styles.dot, index < filledCount ? styles.filledDot : styles.emptyDot]} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: spacing.xl,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: borderRadius.round,
    marginHorizontal: spacing.sm,
  },
  filledDot: {
    backgroundColor: lightColors.primary,
  },
  emptyDot: {
    backgroundColor: lightColors.border,
  },
});

export default PinDisplay;
