import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import { PurchaseOrderRow, PurchaseOrderItemRow, VendorRow } from '../repositories/ProcurementRepository';
import { vendorReturnStyles as styles } from './vendorReturnStyles';

export type ReturnQtyEntry = Record<string, { qty: string; reason: string }>;

interface VendorReturnCreateViewProps {
  purchaseOrders: PurchaseOrderRow[];
  vendors: VendorRow[];
  selectedPOId: string;
  selectedVendorId: string;
  notes: string;
  poItems: PurchaseOrderItemRow[];
  returnQtys: ReturnQtyEntry;
  isProcessing: boolean;
  onBack: () => void;
  onSelectPO: (poId: string) => void;
  onNotesChange: (notes: string) => void;
  onReturnQtyChange: (itemId: string, field: 'qty' | 'reason', value: string) => void;
  onCreate: () => void;
}

/** Create a vendor return — pick a received PO, then per-item return qty + reason. */
export const VendorReturnCreateView: React.FC<VendorReturnCreateViewProps> = ({
  purchaseOrders,
  vendors,
  selectedPOId,
  selectedVendorId,
  notes,
  poItems,
  returnQtys,
  isProcessing,
  onBack,
  onSelectPO,
  onNotesChange,
  onReturnQtyChange,
  onCreate,
}) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={lightColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title}>New Vendor Return</Text>
      <View style={styles.headerSpacer} />
    </View>

    <ScrollView style={styles.content}>
      <Text style={styles.label}>Purchase Order *</Text>
      <View style={styles.pickerContainer}>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => {
            Alert.alert('Select Purchase Order', 'Choose a received purchase order', [
              ...purchaseOrders.map(po => ({
                text: `PO ${po.id.slice(-8)} - ${vendors.find(v => v.id === po.vendor_id)?.name ?? 'Unknown'}`,
                onPress: () => onSelectPO(po.id),
              })),
              { text: 'Cancel', style: 'cancel' as const },
            ]);
          }}
        >
          <Text style={selectedPOId ? styles.pickerText : styles.pickerPlaceholder}>
            {selectedPOId
              ? `PO ${selectedPOId.slice(-8)} - ${vendors.find(v => v.id === selectedVendorId)?.name ?? 'Unknown'}`
              : 'Select a purchase order'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={24} color={lightColors.textSecondary} />
        </TouchableOpacity>
      </View>

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

      {poItems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Items to Return</Text>
          {poItems.map(item => (
            <View key={item.id} style={styles.returnItemCard}>
              <View style={styles.returnItemInfo}>
                <Text style={styles.returnItemName}>{item.product_name}</Text>
                <Text style={styles.returnItemReceived}>Received: {item.received_qty}</Text>
              </View>
              <View style={styles.returnItemInputs}>
                <TextInput
                  style={styles.qtyInput}
                  value={returnQtys[item.id]?.qty ?? ''}
                  onChangeText={val => onReturnQtyChange(item.id, 'qty', val)}
                  placeholder="Qty"
                  keyboardType="number-pad"
                  placeholderTextColor={lightColors.textHint}
                />
                <TextInput
                  style={styles.reasonInput}
                  value={returnQtys[item.id]?.reason ?? ''}
                  onChangeText={val => onReturnQtyChange(item.id, 'reason', val)}
                  placeholder="Reason (optional)"
                  placeholderTextColor={lightColors.textHint}
                />
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>

    <View style={styles.actions}>
      <Button
        title="Create Return"
        variant="primary"
        onPress={onCreate}
        loading={isProcessing}
        disabled={isProcessing || !selectedPOId}
        fullWidth
      />
    </View>
  </View>
);
