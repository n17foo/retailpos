import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import { vendorReturnStyles as styles } from './vendorReturnStyles';
import { transferOrderStyles } from './transferOrderStyles';

export interface TransferProductSelection {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface TransferOrderCreateViewProps {
  products: Array<{ id: string; name: string }>;
  selectedProducts: TransferProductSelection[];
  fromLocation: string;
  toLocation: string;
  notes: string;
  isProcessing: boolean;
  onBack: () => void;
  onFromLocationChange: (value: string) => void;
  onToLocationChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onAddProduct: () => void;
  onRemoveProduct: (index: number) => void;
  onQuantityChange: (index: number, quantity: string) => void;
  onCreate: () => void;
}

/** Create a transfer order — from/to locations, notes, product lines with quantities. */
export const TransferOrderCreateView: React.FC<TransferOrderCreateViewProps> = ({
  products,
  selectedProducts,
  fromLocation,
  toLocation,
  notes,
  isProcessing,
  onBack,
  onFromLocationChange,
  onToLocationChange,
  onNotesChange,
  onAddProduct,
  onRemoveProduct,
  onQuantityChange,
  onCreate,
}) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={lightColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title}>New Transfer</Text>
      <View style={styles.headerSpacer} />
    </View>

    <ScrollView style={styles.content}>
      <Text style={styles.label}>From Location *</Text>
      <TextInput
        style={styles.input}
        value={fromLocation}
        onChangeText={onFromLocationChange}
        placeholder="e.g., Main Store"
        placeholderTextColor={lightColors.textHint}
      />

      <Text style={styles.label}>To Location *</Text>
      <TextInput
        style={styles.input}
        value={toLocation}
        onChangeText={onToLocationChange}
        placeholder="e.g., Warehouse"
        placeholderTextColor={lightColors.textHint}
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={onNotesChange}
        placeholder="Optional notes"
        placeholderTextColor={lightColors.textHint}
        multiline
        numberOfLines={3}
      />

      <View style={transferOrderStyles.productsHeader}>
        <Text style={styles.sectionTitle}>Products *</Text>
        <TouchableOpacity onPress={onAddProduct} style={transferOrderStyles.addProductButton}>
          <MaterialIcons name="add" size={20} color={lightColors.primary} />
          <Text style={transferOrderStyles.addProductText}>Add Product</Text>
        </TouchableOpacity>
      </View>

      {selectedProducts.map((sp, index) => {
        const product = products.find(p => p.id === sp.productId);
        return (
          <View key={index} style={transferOrderStyles.productRow}>
            <View style={transferOrderStyles.productInfo}>
              <Text style={transferOrderStyles.productName}>{product?.name ?? 'Unknown'}</Text>
              <TextInput
                style={transferOrderStyles.qtyInput}
                value={String(sp.quantity)}
                onChangeText={val => onQuantityChange(index, val)}
                keyboardType="number-pad"
                placeholder="Qty"
              />
            </View>
            <TouchableOpacity onPress={() => onRemoveProduct(index)}>
              <MaterialIcons name="close" size={20} color={lightColors.error} />
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>

    <View style={styles.actions}>
      <Button title="Create Transfer" variant="primary" onPress={onCreate} loading={isProcessing} disabled={isProcessing} fullWidth />
    </View>
  </View>
);
