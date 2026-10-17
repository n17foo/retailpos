import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, hitTarget, interactionStyle } from '../../utils/theme';
import { formatMoney } from '../../utils/money';
import { useCurrency } from '../../hooks/useCurrency';
import { OptimizedImage } from '../../components/OptimizedImage';
import type { SearchProduct } from '../../services/search/SearchServiceInterface';

interface SearchResultsProps {
  results: SearchProduct[];
  isSearching: boolean;
  query: string;
  onAdd: (product: SearchProduct) => void;
}

/**
 * Search results list — replaces the catalogue grid while the omnibar has a
 * query (spec §4.4.2). Every result is tappable to add straight to the basket.
 */
const SearchResultsInner: React.FC<SearchResultsProps> = ({ results, isSearching, query, onAdd }) => {
  const currency = useCurrency();

  const renderItem = useCallback(
    ({ item }: { item: SearchProduct }) => {
      const unavailable = !item.inStock;
      return (
        <Pressable
          style={state => [styles.row, unavailable && styles.rowDisabled, !unavailable && interactionStyle(state)]}
          onPress={() => !unavailable && onAdd(item)}
          disabled={unavailable}
          accessibilityRole="button"
          accessibilityState={{ disabled: unavailable }}
          accessibilityLabel={`${item.name}, ${formatMoney(item.price, currency.code)}${unavailable ? ', out of stock' : ''}`}
        >
          <OptimizedImage source={item.imageUrl ? { uri: item.imageUrl } : null} style={styles.thumb} resizeMode="cover" />
          <View style={styles.info}>
            <Text style={[styles.name, unavailable && styles.nameDisabled]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[item.sku && `SKU ${item.sku}`, item.barcode, item.category].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={styles.right}>
            <Text style={[styles.price, unavailable && styles.nameDisabled]}>{formatMoney(item.price, currency.code)}</Text>
            {unavailable ? (
              <Text style={styles.oos}>Out of stock</Text>
            ) : (
              <MaterialIcons name="add-circle-outline" size={22} color={lightColors.primary} />
            )}
          </View>
        </Pressable>
      );
    },
    [onAdd, currency.code]
  );

  if (isSearching && results.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={lightColors.primary} />
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="search-off" size={56} color={lightColors.textSecondary} />
        <Text style={styles.emptyTitle}>No results</Text>
        <Text style={styles.emptyHint}>{query ? `No products match “${query}”` : 'Type to search the whole catalogue'}</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={results}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
};

export const SearchResults = memo(SearchResultsInner);

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.sm },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: '600', color: lightColors.textPrimary, marginTop: spacing.md },
  emptyHint: { fontSize: typography.fontSize.md, color: lightColors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: hitTarget.touchMin + spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    gap: spacing.sm,
  },
  rowDisabled: { opacity: 0.5 },
  thumb: { width: 44, height: 44, borderRadius: borderRadius.sm, backgroundColor: lightColors.border },
  info: { flex: 1 },
  name: { fontSize: typography.fontSize.md, fontWeight: '600', color: lightColors.textPrimary },
  nameDisabled: { color: lightColors.textSecondary },
  meta: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  price: { fontSize: typography.fontSize.md, fontWeight: '700', color: lightColors.primary },
  oos: { fontSize: typography.fontSize.xs, color: lightColors.error, fontWeight: '600' },
});
