import React, { memo } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { lightColors, spacing, borderRadius, typography, interactionStyle } from '../../utils/theme';

interface CategoryButtonProps {
  label: string;
  selected?: boolean;
  /** Trailing '>' hint for a button that drills into sub-categories */
  hasChildren?: boolean;
  /** Leading '‹' for the drill-up chip */
  isBackChip?: boolean;
  onPress: () => void;
  /** Touch targets get 56px, pointer gets 44px (spec §4.8.3) */
  targetSize?: number;
}

/**
 * One category button in the persistent category bar.
 * Minimum width 88px, label wraps to at most two lines.
 */
const CategoryButtonInner: React.FC<CategoryButtonProps> = ({
  label,
  selected = false,
  hasChildren = false,
  isBackChip = false,
  onPress,
  targetSize = 48,
}) => (
  <Pressable
    style={state => [
      styles.button,
      { minHeight: targetSize },
      selected && styles.buttonSelected,
      isBackChip && styles.backChip,
      interactionStyle(state),
    ]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={isBackChip ? `Back to ${label}` : label}
  >
    <Text
      style={[styles.label, selected && styles.labelSelected, isBackChip && styles.backLabel]}
      numberOfLines={2}
      maxFontSizeMultiplier={1.3}
    >
      {isBackChip ? `‹ ${label}` : label}
      {hasChildren && !isBackChip ? ' ›' : ''}
    </Text>
  </Pressable>
);

export const CategoryButton = memo(CategoryButtonInner);

const styles = StyleSheet.create({
  button: {
    minWidth: 88,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  buttonSelected: {
    backgroundColor: lightColors.primary,
    borderColor: lightColors.primary,
  },
  backChip: {
    backgroundColor: lightColors.background,
    borderStyle: 'dashed',
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    textAlign: 'center',
  },
  labelSelected: {
    color: lightColors.textOnPrimary,
  },
  backLabel: {
    color: lightColors.textSecondary,
  },
});
