import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { Button } from '../../../shared/components/Button';
import { ExchangeSession } from '../services/exchange/ExchangeService';
import { exchangeStyles as styles } from './exchangeStyles';

export interface ExchangeProductInput {
  id: string;
  name: string;
  price: number;
  variantId?: string;
  sku?: string;
}

interface ExchangeAddItemsStepProps {
  session: ExchangeSession;
  currencyCode: string;
  /** Catalogue products available to exchange into — resolved by the screen */
  products: ExchangeProductInput[];
  isLoadingProducts?: boolean;
  onAddProduct: (product: ExchangeProductInput) => void;
  onRemoveItem: (itemId: string) => void;
  onNext: () => void;
}

const MAX_VISIBLE_PRODUCTS = 25;

/** Step 2 — add the new items the customer takes in exchange, from the real catalogue. */
export const ExchangeAddItemsStep: React.FC<ExchangeAddItemsStepProps> = ({
  session,
  currencyCode,
  products,
  isLoadingProducts,
  onAddProduct,
  onRemoveItem,
  onNext,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const visibleProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? products.filter(p => p.name.toLowerCase().includes(query) || (p.sku ?? '').toLowerCase().includes(query))
      : products;
    return filtered.slice(0, MAX_VISIBLE_PRODUCTS);
  }, [products, searchQuery]);

  return (
    <View style={styles.stepContent}>
      <View style={styles.netDueBanner}>
        <Text style={styles.netDueLabel}>
          {session.netDue > 0.01
            ? `Amount due: ${formatMoney(session.netDue, currencyCode)}`
            : session.netDue < -0.01
              ? `Refund due: ${formatMoney(Math.abs(session.netDue), currencyCode)}`
              : 'No payment required'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>New items in exchange</Text>
      {session.newItems.length === 0 ? (
        <Text style={styles.emptyText}>No new items added yet. Search the catalogue below to add products.</Text>
      ) : (
        <FlatList
          data={session.newItems}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.newItem}>
              <View style={styles.returnItemInfo}>
                <Text style={styles.returnItemName}>{item.name}</Text>
                <Text style={styles.returnItemPrice}>
                  {formatMoney(item.price, currencyCode)} × {item.quantity}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => onRemoveItem(item.id)}
                style={styles.removeButton}
                accessibilityLabel="Remove item"
                accessibilityRole="button"
              >
                <MaterialIcons name="delete-outline" size={20} color={lightColors.error} />
              </TouchableOpacity>
            </View>
          )}
          style={styles.list}
        />
      )}

      <TextInput
        style={styles.searchInput}
        placeholder="Search products by name or SKU"
        placeholderTextColor={lightColors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        accessibilityLabel="Search products"
      />

      {isLoadingProducts ? (
        <ActivityIndicator size="small" color={lightColors.primary} style={styles.productLoader} />
      ) : (
        <FlatList
          data={visibleProducts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onAddProduct(item)}
              style={styles.productRow}
              accessibilityLabel={`Add ${item.name}`}
              accessibilityRole="button"
            >
              <View style={styles.returnItemInfo}>
                <Text style={styles.returnItemName}>{item.name}</Text>
                {item.sku ? <Text style={styles.returnItemPrice}>SKU {item.sku}</Text> : null}
              </View>
              <Text style={styles.productPrice}>{formatMoney(item.price, currencyCode)}</Text>
              <MaterialIcons name="add-circle-outline" size={22} color={lightColors.primary} />
            </TouchableOpacity>
          )}
          style={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No products found.</Text>}
        />
      )}

      <View style={styles.footer}>
        <Button title="Next: Settle Payment" variant="primary" fullWidth onPress={onNext} />
      </View>
    </View>
  );
};
