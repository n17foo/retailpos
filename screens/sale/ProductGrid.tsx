import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';
import { ProductCard } from './ProductCard';
import VariantPicker from '../../components/VariantPicker';
import { UnifiedProductVariant } from '../../services/product/types';
import type { DisplayProduct } from '../../services/product/displayProduct';
import { useCurrency } from '../../hooks/useCurrency';
import type { TileDensity, SaleLayout } from '../../utils/responsive.utils';

interface ProductGridProps {
  products: DisplayProduct[];
  onAdd: (product: DisplayProduct, variantId?: string) => void;
  /** productId → total basket quantity (all variant lines summed) */
  basketItemsMap?: Record<string, number>;
  layout: SaleLayout;
  density: TileDensity;
  isLoading?: boolean;
  onLoadMore?: () => void;
}

/**
 * Catalogue grid — density-driven tiles (large/compact/text) with badge-only
 * quantity, skeletons while loading, and an inline variant picker.
 */
const ProductGridInner: React.FC<ProductGridProps> = ({
  products,
  onAdd,
  basketItemsMap = {},
  layout,
  density,
  isLoading = false,
  onLoadMore,
}) => {
  const currency = useCurrency();
  const [pickerProduct, setPickerProduct] = useState<DisplayProduct | null>(null);

  const numColumns = layout.productColumns(density);
  const isList = density === 'text';

  const handleCardPress = useCallback(
    (id: string) => {
      const product = products.find(p => p.id === id);
      if (product?.variants && product.variants.length > 1) {
        setPickerProduct(product);
        return;
      }
      if (product) onAdd(product);
    },
    [products, onAdd]
  );

  const handleVariantSelect = useCallback(
    (variant: UnifiedProductVariant) => {
      if (!pickerProduct) return;
      onAdd(pickerProduct, variant.id);
      setPickerProduct(null);
    },
    [pickerProduct, onAdd]
  );

  const renderItem = useCallback(
    ({ item }: { item: DisplayProduct }) => (
      <ProductCard
        id={item.id}
        name={item.name}
        price={item.price}
        image={item.image}
        stock={item.variants ? undefined : item.stock}
        sellable={item.sellable}
        quantity={basketItemsMap[item.id] || 0}
        density={density}
        onPress={handleCardPress}
      />
    ),
    [handleCardPress, basketItemsMap, density]
  );

  const keyExtractor = useCallback((item: DisplayProduct) => item.id, []);

  const skeletonData = useMemo(() => Array.from({ length: numColumns * 4 }, (_, i) => `skel-${i}`), [numColumns]);

  if (isLoading && products.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.skeletonWrap, { flexDirection: isList ? 'column' : 'row', flexWrap: 'wrap' }]}>
          {skeletonData.map(k => (
            <View
              key={k}
              style={[
                styles.skeleton,
                isList ? styles.skeletonRow : { width: `${Math.floor(100 / numColumns) - 2}%`, height: density === 'compact' ? 130 : 200 },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  if (!isLoading && products.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <MaterialIcons name="inventory-2" size={56} color={lightColors.textSecondary} />
        <Text style={styles.emptyTitle}>No products</Text>
        <Text style={styles.emptyHint}>This category has no sellable products</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={products}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={isList ? 1 : numColumns}
        key={`${density}-${numColumns}`}
        showsVerticalScrollIndicator={false}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
      />
      {isLoading && (
        <View style={styles.footerSpinner}>
          <ActivityIndicator color={lightColors.primary} />
        </View>
      )}

      {pickerProduct && pickerProduct.variants && (
        <VariantPicker
          visible={true}
          productTitle={pickerProduct.name}
          variants={pickerProduct.variants}
          options={pickerProduct.options ?? []}
          currencyCode={currency.code}
          onSelect={handleVariantSelect}
          onClose={() => setPickerProduct(null)}
        />
      )}
    </View>
  );
};

export const ProductGrid = memo(ProductGridInner);

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xs },
  centered: { justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: '600', color: lightColors.textPrimary, marginTop: spacing.md },
  emptyHint: { fontSize: typography.fontSize.md, color: lightColors.textSecondary, marginTop: spacing.xs },
  skeletonWrap: { padding: spacing.sm },
  skeleton: {
    backgroundColor: lightColors.border,
    borderRadius: borderRadius.md,
    margin: spacing.xs,
    opacity: 0.5,
  },
  skeletonRow: { height: 52, marginVertical: 1 },
  footerSpinner: { paddingVertical: spacing.sm },
});
