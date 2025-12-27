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
}

export const ProductCard: React.FC<ProductCardProps> = ({ id, name, price, image, onAddToCart, inCart = false, initialQuantity = 0 }) => {
  const [quantity, setQuantity] = useState(initialQuantity);

  // Sync local quantity state with prop when it changes (e.g., from basket context)
  useEffect(() => {
    setQuantity(initialQuantity);
  }, [initialQuantity]);

  // Tap on card - add to cart or increment quantity
  const handleCardPress = () => {
    const newQuantity = quantity + 1;
    setQuantity(newQuantity);
    onAddToCart(id, newQuantity);
  };

  // Increment quantity
  const handleIncrement = (e: any) => {
    e.stopPropagation?.();
    const newQuantity = quantity + 1;
    setQuantity(newQuantity);
    onAddToCart(id, newQuantity);
  };

  // Decrement quantity
  const handleDecrement = (e: any) => {
    e.stopPropagation?.();
    if (quantity > 0) {
      const newQuantity = quantity - 1;
      setQuantity(newQuantity);
      onAddToCart(id, newQuantity);
    }
  };

  const isInCart = inCart || quantity > 0;

  return (
    <TouchableOpacity style={[styles.card, isInCart && styles.cardInCart]} onPress={handleCardPress} activeOpacity={0.7}>
      {/* Product Image - takes most of the card */}
      <View style={styles.imageContainer}>
        <Image source={image} style={styles.image} resizeMode="cover" />

        {/* Quantity badge overlay when in cart */}
        {isInCart && (
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityBadgeText}>{quantity}</Text>
          </View>
        )}
      </View>

      {/* Product info at the bottom */}
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
          {name}
        </Text>
        <Text style={styles.price}>${price.toFixed(2)}</Text>
      </View>

      {/* Quantity controls overlay - only show when in cart */}
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
    margin: spacing.xs,
    width: '47%',
    ...elevation.medium,
    overflow: 'hidden',
  },
  cardInCart: {
    borderWidth: 2,
    borderColor: lightColors.primary,
  },
  imageContainer: {
    width: '100%',
    height: 100,
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
    height: 36, // Fixed height for 2 lines
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
