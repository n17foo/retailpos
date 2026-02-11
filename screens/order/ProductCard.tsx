import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ImageSourcePropType } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: ImageSourcePropType;
  onAddToCart: (id: string, quantity: number) => void;
  inCart?: boolean;
  initialQuantity?: number;
  stock?: number;
  widthPercent?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  price,
  image,
  onAddToCart,
  inCart = false,
  initialQuantity = 0,
  stock,
  widthPercent,
}) => {
  const [quantity, setQuantity] = useState(initialQuantity);

  useEffect(() => {
    setQuantity(initialQuantity);
  }, [initialQuantity]);

  const handleCardPress = () => {
    const newQuantity = quantity + 1;
    setQuantity(newQuantity);
    onAddToCart(id, newQuantity);
  };

  const handleIncrement = (e: any) => {
    e.stopPropagation?.();
    const newQuantity = quantity + 1;
    setQuantity(newQuantity);
    onAddToCart(id, newQuantity);
  };

  const handleDecrement = (e: any) => {
    e.stopPropagation?.();
    if (quantity > 0) {
      const newQuantity = quantity - 1;
      setQuantity(newQuantity);
      onAddToCart(id, newQuantity);
    }
  };

  const isInCart = inCart || quantity > 0;
  const isOutOfStock = stock !== undefined && stock <= 0;
  const isLowStock = stock !== undefined && stock > 0 && stock <= 5;

  const cardWidth = widthPercent ? `${widthPercent}%` as any : '47%';

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }, isInCart && styles.cardInCart, isOutOfStock && styles.cardOutOfStock]}
      onPress={handleCardPress}
      activeOpacity={0.7}
      disabled={isOutOfStock}
    >
      <View style={styles.imageContainer}>
        <Image source={image} style={styles.image} resizeMode="cover" />

        {isInCart && (
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityBadgeText}>{quantity}</Text>
          </View>
        )}

        {/* Stock indicator */}
        {isOutOfStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
        {isLowStock && !isInCart && (
          <View style={styles.lowStockBadge}>
            <Text style={styles.lowStockText}>{stock} left</Text>
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
          {name}
        </Text>
        <Text style={styles.price}>${price.toFixed(2)}</Text>
      </View>

      {isInCart && (
        <View style={styles.quantityOverlay}>
          <TouchableOpacity style={styles.quantityButton} onPress={handleDecrement} activeOpacity={0.8}>
            <Text style={styles.quantityButtonText}>−</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quantityButton} onPress={handleIncrement} activeOpacity={0.8}>
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    flex: 1,
    margin: spacing.xs,
    ...elevation.medium,
    overflow: 'hidden',
  },
  cardInCart: {
    borderWidth: 2,
    borderColor: lightColors.primary,
  },
  cardOutOfStock: {
    opacity: 0.6,
  },
  imageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
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
    minWidth: 28,
    height: 28,
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
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
    alignItems: 'center',
  },
  name: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.xs,
    color: lightColors.textPrimary,
    height: 36,
  },
  price: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.primary,
  },
  quantityOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  quantityButton: {
    backgroundColor: lightColors.primary,
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textOnPrimary,
  },
});
