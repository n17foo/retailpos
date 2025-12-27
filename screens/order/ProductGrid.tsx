import React from 'react';
import { View, FlatList, StyleSheet, ImageSourcePropType } from 'react-native';
import { spacing } from '../../utils/theme';
import { ProductCard } from './ProductCard';
import { ECommercePlatform } from '../../utils/platforms';

/**
 * Display-ready product interface
 * This is the format expected by ProductGrid, derived from UnifiedProduct
 */
export interface DisplayProduct {
  /** Unique app ID (platform-prefixed) */
  id: string;
  /** Original platform ID */
  platformId?: string;
  /** Product name/title */
  name: string;
  /** Price of default variant */
  price: number;
  /** Product image */
  image: ImageSourcePropType | null;
  /** Quantity in cart */
  quantity?: number;
  /** Category ID */
  categoryId?: string;
  /** Category name (productType) */
  categoryName?: string;
  /** SKU */
  sku?: string;
  /** Barcode */
  barcode?: string;
  /** Stock quantity */
  stock?: number;
  /** Whether this is from an ecommerce platform */
  isEcommerceProduct?: boolean;
  /** Variant ID */
  variantId?: string;
  /** Source platform */
  platform?: ECommercePlatform;
  /** Product description */
  description?: string;
}

interface ProductGridProps {
  products: DisplayProduct[];
  onAddToCart: (id: string, quantity: number) => void;
  cartItems?: Record<string, number>;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products, onAddToCart, cartItems = {} }) => {
  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={({ item }) => (
          <ProductCard
            id={item.id}
            name={item.name}
            price={item.price}
            image={item.image}
            onAddToCart={onAddToCart}
            inCart={!!cartItems[item.id]}
            initialQuantity={cartItems[item.id] || 0}
          />
        )}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xs,
  },
  row: {
    justifyContent: 'space-between',
  },
});
