import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';

export interface ProductSelection {
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  price?: number;
  selected: boolean;
  quantity: number;
}

interface BarcodeLabelProductRowProps {
  item: ProductSelection;
  currencyCode: string;
  onToggle: (productId: string) => void;
  onQuantityChange: (productId: string, quantity: string) => void;
}

/** Selectable product row for barcode label printing — checkbox + qty input when selected. */
export const BarcodeLabelProductRow: React.FC<BarcodeLabelProductRowProps> = ({ item, currencyCode, onToggle, onQuantityChange }) => (
  <TouchableOpacity style={[styles.productCard, item.selected && styles.productCardSelected]} onPress={() => onToggle(item.productId)}>
    <View style={styles.productHeader}>
      <View style={styles.checkbox}>
        <MaterialIcons
          name={item.selected ? 'check-box' : 'check-box-outline-blank'}
          size={24}
          color={item.selected ? lightColors.primary : lightColors.textSecondary}
        />
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        {item.sku && <Text style={styles.productSku}>SKU: {item.sku}</Text>}
        {item.price !== undefined && <Text style={styles.productPrice}>{formatMoney(item.price, currencyCode)}</Text>}
      </View>
      {item.selected && (
        <View style={styles.quantityContainer}>
          <Text style={styles.quantityLabel}>Qty:</Text>
          <TextInput
            style={styles.quantityInput}
            value={item.quantity.toString()}
            onChangeText={val => onQuantityChange(item.productId, val)}
            keyboardType="number-pad"
            selectTextOnFocus
          />
        </View>
      )}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: lightColors.background,
    ...elevation.low,
  },
  productCardSelected: {
    borderColor: lightColors.primary,
    backgroundColor: lightColors.primary + '08',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  productSku: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  productPrice: {
    fontSize: typography.fontSize.sm,
    color: lightColors.success,
    fontWeight: '600',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quantityLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  quantityInput: {
    width: 50,
    height: 32,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.inputBackground,
  },
});
