import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { Button } from '../../../shared/components/Button';
import { generateUUID } from '../../../shared/utils/uuid';
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
  onAddProduct: (product: ExchangeProductInput) => void;
  onRemoveItem: (itemId: string) => void;
  onNext: () => void;
}

/** Step 2 — add the new items the customer takes in exchange. */
export const ExchangeAddItemsStep: React.FC<ExchangeAddItemsStepProps> = ({
  session,
  currencyCode,
  onAddProduct,
  onRemoveItem,
  onNext,
}) => (
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
      <Text style={styles.emptyText}>No new items added yet. Use the buttons below to add products.</Text>
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

    {/* Quick-add demo products — in a real implementation this would be a product search */}
    <View style={styles.addItemHint}>
      <MaterialIcons name="info-outline" size={16} color={lightColors.textSecondary} />
      <Text style={styles.addItemHintText}>
        Tap "Add Sample Item" to add a product. In production, integrate with the product catalogue.
      </Text>
    </View>
    <Button
      title="+ Add Sample Item ($10.00)"
      variant="outline"
      fullWidth
      onPress={() => onAddProduct({ id: generateUUID(), name: 'Exchange Item', price: 10.0 })}
      style={styles.addItemButton}
    />

    <View style={styles.footer}>
      <Button title="Next: Settle Payment" variant="primary" fullWidth onPress={onNext} />
    </View>
  </View>
);
