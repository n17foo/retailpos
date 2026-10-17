import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet, ImageSourcePropType } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation, hitTarget, interactionStyle } from '../../utils/theme';
import { formatMoney } from '../../utils/money';
import { useCurrency } from '../../hooks/useCurrency';
import { OptimizedImage } from '../../components/OptimizedImage';
import type { TileDensity } from '../../utils/responsive.utils';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: ImageSourcePropType | null;
  onPress: (id: string) => void;
  /** Total basket quantity for this product (all variant lines summed) */
  quantity?: number;
  /** Available stock when tracked; undefined when stock is not tracked or varies by variant */
  stock?: number;
  /** False when nothing can be sold (tracked stock exhausted or platform marks it unavailable) */
  sellable?: boolean;
  density?: TileDensity;
  /** Touch gets 48px targets, pointer 40px */
  targetSize?: number;
}

/**
 * A catalogue tile. Tiles never resize when an item is added — only the
 * quantity badge changes (spec §4.4).
 */
const ProductCardInner: React.FC<ProductCardProps> = ({
  id,
  name,
  price,
  image,
  onPress,
  quantity = 0,
  stock,
  sellable = true,
  density = 'large',
  targetSize = hitTarget.touchMin,
}) => {
  const currency = useCurrency();

  const isInBasket = quantity > 0;
  const isOutOfStock = !sellable;
  const isLowStock = stock !== undefined && stock > 0 && stock <= 5;

  const a11y = `${name}, ${formatMoney(price, currency.code)}${isOutOfStock ? ', out of stock' : ''}${isInBasket ? `, ${quantity} in basket` : ''}`;

  const badge = isInBasket ? (
    <View style={styles.quantityBadge}>
      <Text style={styles.quantityBadgeText}>{quantity}</Text>
    </View>
  ) : null;

  const stockBadges = (
    <>
      {isOutOfStock && (
        <View style={density === 'text' ? styles.textOutOfStock : styles.outOfStockOverlay}>
          <Text style={styles.outOfStockText}>Out of Stock</Text>
        </View>
      )}
      {isLowStock && !isOutOfStock && density !== 'text' && (
        <View style={styles.lowStockBadge}>
          <Text style={styles.lowStockText}>{stock} left</Text>
        </View>
      )}
    </>
  );

  if (density === 'text') {
    return (
      <Pressable
        style={state => [
          styles.textRow,
          { minHeight: targetSize },
          isInBasket && styles.rowInCart,
          isOutOfStock && styles.cardOutOfStock,
          !isOutOfStock && interactionStyle(state),
        ]}
        onPress={() => onPress(id)}
        disabled={isOutOfStock}
        accessibilityLabel={a11y}
        accessibilityRole="button"
        accessibilityState={{ disabled: isOutOfStock }}
      >
        <Text style={styles.textRowName} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {name}
        </Text>
        {badge}
        <Text style={styles.textRowPrice} maxFontSizeMultiplier={1.3}>
          {formatMoney(price, currency.code)}
        </Text>
        {isOutOfStock && <Text style={styles.textRowOos}>Out of stock</Text>}
      </Pressable>
    );
  }

  const compact = density === 'compact';

  return (
    <Pressable
      style={state => [
        styles.card,
        isInBasket && styles.cardInCart,
        isOutOfStock && styles.cardOutOfStock,
        !isOutOfStock && interactionStyle(state),
      ]}
      onPress={() => onPress(id)}
      disabled={isOutOfStock}
      accessibilityLabel={a11y}
      accessibilityRole="button"
      accessibilityState={{ disabled: isOutOfStock }}
    >
      <View style={[styles.imageContainer, compact && styles.imageContainerCompact]}>
        <OptimizedImage source={image} style={styles.image} resizeMode="cover" priority="normal" />
        {badge}
        {stockBadges}
      </View>
      <View style={compact ? styles.infoCompact : styles.infoContainer}>
        <Text
          style={compact ? styles.nameCompact : styles.name}
          numberOfLines={compact ? 1 : 2}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={1.3}
        >
          {name}
        </Text>
        <Text style={compact ? styles.priceCompact : styles.price} maxFontSizeMultiplier={1.3}>
          {formatMoney(price, currency.code)}
        </Text>
      </View>
    </Pressable>
  );
};

export const ProductCard = memo(ProductCardInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    margin: spacing.xs,
    ...elevation.medium,
    overflow: 'hidden',
  },
  cardInCart: {
    borderWidth: 2,
    borderColor: lightColors.primary,
  },
  cardOutOfStock: {
    opacity: 0.55,
  },
  imageContainer: {
    width: '100%',
    height: 130,
    position: 'relative',
    backgroundColor: lightColors.border,
  },
  imageContainerCompact: {
    height: 72,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  quantityBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: lightColors.primary,
    borderRadius: borderRadius.round,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  quantityBadgeText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: lightColors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textOutOfStock: { marginLeft: spacing.sm },
  outOfStockText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  lowStockBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    backgroundColor: lightColors.warning,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  lowStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  infoContainer: {
    padding: spacing.sm,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  infoCompact: {
    padding: spacing.xs,
  },
  name: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.xs,
    color: lightColors.textPrimary,
    minHeight: 34,
  },
  nameCompact: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  price: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.primary,
  },
  priceCompact: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: lightColors.primary,
  },
  // ── text density: a list row, not a card ──
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    marginHorizontal: spacing.sm,
    marginVertical: 1,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
  },
  rowInCart: { borderLeftWidth: 3, borderLeftColor: lightColors.primary },
  textRowName: { flex: 1, fontSize: typography.fontSize.sm, fontWeight: '500', color: lightColors.textPrimary },
  textRowPrice: { fontSize: typography.fontSize.sm, fontWeight: '700', color: lightColors.primary },
  textRowOos: { fontSize: typography.fontSize.xs, color: lightColors.error, fontWeight: '600' },
});
