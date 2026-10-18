import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { getCurrencySymbol } from '../../../shared/utils/currency';
import { offlineSetupStyles as styles } from './offlineSetupStyles';
import type { OfflineCategory } from '../screens/OfflineSetupStep';

interface OfflineCategoryCardProps {
  category: OfflineCategory;
  isExpanded: boolean;
  currency: string;
  newProductName: string;
  newProductPrice: string;
  newProductSku: string;
  onToggleExpand: (categoryId: string) => void;
  onRemoveCategory: (categoryId: string) => void;
  onRemoveProduct: (categoryId: string, productId: string) => void;
  onAddProduct: (categoryId: string) => void;
  onNewProductNameChange: (value: string) => void;
  onNewProductPriceChange: (value: string) => void;
  onNewProductSkuChange: (value: string) => void;
}

/** Expandable category card — product list plus inline add-product form. */
export const OfflineCategoryCard: React.FC<OfflineCategoryCardProps> = ({
  category,
  isExpanded,
  currency,
  newProductName,
  newProductPrice,
  newProductSku,
  onToggleExpand,
  onRemoveCategory,
  onRemoveProduct,
  onAddProduct,
  onNewProductNameChange,
  onNewProductPriceChange,
  onNewProductSkuChange,
}) => (
  <View style={styles.categoryCard}>
    <TouchableOpacity style={styles.categoryHeader} onPress={() => onToggleExpand(category.id)}>
      <View style={styles.categoryHeaderLeft}>
        <Text style={styles.categoryIcon}>{isExpanded ? '▼' : '▶'}</Text>
        <Text style={styles.categoryName}>{category.name}</Text>
        <Text style={styles.productCount}>({category.products.length})</Text>
      </View>
      <TouchableOpacity onPress={() => onRemoveCategory(category.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
    </TouchableOpacity>

    {isExpanded && (
      <View style={styles.categoryBody}>
        {category.products.map(product => (
          <View key={product.id} style={styles.productRow}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>
                {getCurrencySymbol(currency)} {parseFloat(product.price).toFixed(2)}
              </Text>
              {product.sku && <Text style={styles.productSku}>SKU: {product.sku}</Text>}
            </View>
            <TouchableOpacity onPress={() => onRemoveProduct(category.id, product.id)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add product form */}
        <View style={styles.addProductForm}>
          <TextInput
            style={[styles.input, styles.productInput]}
            value={newProductName}
            onChangeText={onNewProductNameChange}
            placeholder="Product name"
            autoCapitalize="words"
          />
          <View style={styles.priceSkuRow}>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={newProductPrice}
              onChangeText={onNewProductPriceChange}
              placeholder="Price"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, styles.skuInput]}
              value={newProductSku}
              onChangeText={onNewProductSkuChange}
              placeholder="SKU (optional)"
              autoCapitalize="characters"
            />
          </View>
          <TouchableOpacity style={styles.addProductButton} onPress={() => onAddProduct(category.id)}>
            <Text style={styles.addProductButtonText}>+ Add Product</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
  </View>
);
