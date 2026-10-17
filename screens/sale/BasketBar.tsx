import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightColors, spacing, borderRadius, typography, hitTarget, interactionStyle } from '../../utils/theme';
import { formatMoney } from '../../utils/money';
import { useCurrency } from '../../hooks/useCurrency';

interface BasketBarProps {
  itemCount: number;
  total: number;
  onPress: () => void;
}

/**
 * Sticky basket bar on the stacked (phone) shell — always visible at the
 * bottom of the catalogue; opens the basket bottom sheet.
 */
const BasketBarInner: React.FC<BasketBarProps> = ({ itemCount, total, onPress }) => {
  const insets = useSafeAreaInsets();
  const currency = useCurrency();

  return (
    <Pressable
      style={state => [styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }, interactionStyle(state)]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={itemCount > 0 ? `Basket, ${itemCount} items, total ${formatMoney(total, currency.code)}` : 'Basket, empty'}
    >
      <View style={styles.left}>
        <MaterialIcons name="shopping-cart" size={22} color={lightColors.textOnPrimary} />
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{itemCount}</Text>
        </View>
      </View>
      <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {itemCount > 0 ? 'Basket' : 'Basket — empty'}
      </Text>
      <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {formatMoney(total, currency.code)}
      </Text>
      <MaterialIcons name="keyboard-arrow-up" size={22} color={lightColors.textOnPrimary} />
    </Pressable>
  );
};

export const BasketBar = memo(BasketBarInner);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: hitTarget.touchTender,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: lightColors.primary,
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
    gap: spacing.sm,
  },
  left: { flexDirection: 'row', alignItems: 'center' },
  countBadge: {
    backgroundColor: lightColors.textOnPrimary,
    borderRadius: borderRadius.round,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    paddingHorizontal: 6,
  },
  countText: { fontSize: typography.fontSize.sm, fontWeight: '700', color: lightColors.primary },
  label: { flex: 1, fontSize: typography.fontSize.md, fontWeight: '600', color: lightColors.textOnPrimary },
  total: { fontSize: typography.fontSize.lg, fontWeight: '700', color: lightColors.textOnPrimary },
});
