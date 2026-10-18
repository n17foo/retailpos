import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { formatMoney, multiplyMoney, sumMoney } from '../../../shared/utils/money';
import { Button } from '../../../shared/components/Button';
import { exchangeStyles as styles } from './exchangeStyles';

export interface ReturnableItem {
  orderItemId: string;
  productId: string;
  variantId: string | null;
  name: string;
  price: number;
  originalQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
}

interface ExchangeReturnItemsStepProps {
  orderId: string;
  items: ReturnableItem[];
  quantities: Record<string, number>;
  currencyCode: string;
  onQuantityChange: (orderItemId: string, delta: number) => void;
  onNext: () => void;
}

/** Step 1 — pick which items (and how many) to return from the order. */
export const ExchangeReturnItemsStep: React.FC<ExchangeReturnItemsStepProps> = ({
  orderId,
  items,
  quantities,
  currencyCode,
  onQuantityChange,
  onNext,
}) => (
  <View style={styles.stepContent}>
    <Text style={styles.sectionTitle}>Select items to return from order #{orderId.slice(-8)}</Text>
    {items.length === 0 ? (
      <Text style={styles.emptyText}>No returnable items found for this order.</Text>
    ) : (
      <FlatList
        data={items}
        keyExtractor={item => item.orderItemId}
        renderItem={({ item }) => {
          const qty = quantities[item.orderItemId] ?? 0;
          return (
            <View style={styles.returnItem}>
              <View style={styles.returnItemInfo}>
                <Text style={styles.returnItemName}>{item.name}</Text>
                <Text style={styles.returnItemPrice}>
                  {formatMoney(item.price, currencyCode)} × {item.returnableQuantity} available
                </Text>
              </View>
              <View style={styles.qtyControl}>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => onQuantityChange(item.orderItemId, -1)}
                  disabled={qty === 0}
                  accessibilityLabel="Decrease quantity"
                  accessibilityRole="button"
                >
                  <Text style={[styles.qtyButtonText, qty === 0 && styles.qtyButtonDisabled]}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{qty}</Text>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => onQuantityChange(item.orderItemId, 1)}
                  disabled={qty >= item.returnableQuantity}
                  accessibilityLabel="Increase quantity"
                  accessibilityRole="button"
                >
                  <Text style={[styles.qtyButtonText, qty >= item.returnableQuantity && styles.qtyButtonDisabled]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        style={styles.list}
      />
    )}
    <View style={styles.footer}>
      <Text style={styles.creditSummary}>
        Return credit: {formatMoney(sumMoney(items.map(i => multiplyMoney(i.price, quantities[i.orderItemId] ?? 0))), currencyCode)}
      </Text>
      <Button
        title="Next: Add New Items"
        variant="primary"
        fullWidth
        onPress={onNext}
        disabled={Object.values(quantities).every(q => q === 0)}
      />
    </View>
  </View>
);
