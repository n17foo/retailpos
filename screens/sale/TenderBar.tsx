import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, interactionStyle } from '../../utils/theme';
import { formatMoney } from '../../utils/money';
import { useCurrency } from '../../hooks/useCurrency';
import type { TenderShortcut } from '../../hooks/useCheckout';

interface TenderBarProps {
  total: number;
  disabled?: boolean;
  /** Card payment capability on this device (tap-to-pay terminal configured) */
  cardAvailable?: boolean;
  onTender: (tender: TenderShortcut) => void;
  /** Touch gets 56px targets, pointer 44px (spec §4.8.3) */
  targetSize?: number;
}

/**
 * Pinned tender buttons at the bottom of the basket
 * (docs/specs/system/sales-screen-fast-path-ux.md §4.7):
 * CASH and CARD start checkout directly; ⋯ exposes other methods + split tender.
 */
const TenderBarInner: React.FC<TenderBarProps> = ({ total, disabled = false, cardAvailable = false, onTender, targetSize = 56 }) => {
  const currency = useCurrency();
  return (
    <View style={styles.bar}>
      <Pressable
        style={state => [
          styles.button,
          styles.cashButton,
          { minHeight: targetSize },
          disabled && styles.buttonDisabled,
          !disabled && interactionStyle(state),
        ]}
        onPress={() => onTender('cash')}
        disabled={disabled}
        accessibilityLabel={`Cash payment, ${formatMoney(total, currency.code)}`}
        accessibilityRole="button"
      >
        <MaterialIcons name="payments" size={22} color={lightColors.textOnPrimary} />
        <Text style={styles.buttonLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          Cash
        </Text>
        <Text style={styles.buttonAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {formatMoney(total, currency.code)}
        </Text>
      </Pressable>

      <Pressable
        style={state => [
          styles.button,
          styles.cardButton,
          { minHeight: targetSize },
          (disabled || !cardAvailable) && styles.buttonDisabled,
          !(disabled || !cardAvailable) && interactionStyle(state),
        ]}
        onPress={() => onTender('card')}
        disabled={disabled || !cardAvailable}
        accessibilityLabel={cardAvailable ? 'Card payment' : 'Card payment unavailable on this device'}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || !cardAvailable }}
      >
        <MaterialIcons name="credit-card" size={22} color={lightColors.textOnPrimary} />
        <Text style={styles.buttonLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          Card
        </Text>
      </Pressable>

      <Pressable
        style={state => [
          styles.button,
          styles.moreButton,
          { minHeight: targetSize },
          disabled && styles.buttonDisabled,
          !disabled && interactionStyle(state),
        ]}
        onPress={() => onTender('method')}
        disabled={disabled}
        accessibilityLabel="Other payment methods and split tender"
        accessibilityRole="button"
      >
        <MaterialIcons name="more-horiz" size={24} color={lightColors.textOnPrimary} />
      </Pressable>
    </View>
  );
};

export const TenderBar = memo(TenderBarInner);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: lightColors.surface,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: { opacity: 0.4 },
  cashButton: { flex: 1.4, backgroundColor: lightColors.success },
  cardButton: { flex: 1, backgroundColor: lightColors.primary },
  moreButton: { width: 64, backgroundColor: lightColors.textSecondary },
  buttonLabel: { fontSize: typography.fontSize.lg, fontWeight: '700', color: lightColors.textOnPrimary, flexShrink: 1 },
  buttonAmount: { fontSize: typography.fontSize.md, fontWeight: '600', color: lightColors.textOnPrimary, opacity: 0.9, flexShrink: 2 },
});
