import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Product } from '../../catalogue/hooks/useOfflineProducts';
import { formatMoney } from '../../../shared/utils/money';
import { productManagementStyles as styles } from './productManagementStyles';

interface ProductCardProps {
  product: Product;
  currencyCode: string;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

/** Product row — thumbnail, title/price/SKU/stock/category, edit + delete actions. */
export const ProductCard: React.FC<ProductCardProps> = ({ product, currencyCode, onEdit, onDelete }) => {
  const defaultVariant = product.variants?.[0];
  const primaryImage = product.images?.[0];

  return (
    <View style={styles.productCard}>
      <View style={styles.productImageContainer}>
        {primaryImage?.url ? (
          <Image source={{ uri: primaryImage.url }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productTitle} numberOfLines={2}>
          {product.title}
        </Text>
        <Text style={styles.productPrice}>{formatMoney(defaultVariant?.price || 0, currencyCode)}</Text>
        {defaultVariant?.sku && <Text style={styles.productSku}>SKU: {defaultVariant.sku}</Text>}
        <Text style={styles.productStock}>Stock: {defaultVariant?.inventoryQuantity || 0}</Text>
        {product.productType && <Text style={styles.productCategory}>{product.productType}</Text>}
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity style={styles.editButton} onPress={() => onEdit(product)}>
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(product)}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
