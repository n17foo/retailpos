import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import { VendorReturnRow, VendorReturnItemRow } from '../repositories/ProcurementRepository';
import { vendorReturnStyles as styles, VENDOR_RETURN_STATUS_COLORS } from './vendorReturnStyles';

interface VendorReturnDetailViewProps {
  vendorReturn: VendorReturnRow;
  items: VendorReturnItemRow[];
  vendorName: string;
  isProcessing: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Single vendor return — vendor/status/notes card, line items, confirm/cancel actions. */
export const VendorReturnDetailView: React.FC<VendorReturnDetailViewProps> = ({
  vendorReturn,
  items,
  vendorName,
  isProcessing,
  onBack,
  onConfirm,
  onCancel,
}) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={lightColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title}>Return Details</Text>
      <View style={styles.headerSpacer} />
    </View>

    <ScrollView style={styles.content}>
      <View style={styles.detailCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Vendor:</Text>
          <Text style={styles.detailValue}>{vendorName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: VENDOR_RETURN_STATUS_COLORS[vendorReturn.status] + '20' }]}>
            <Text style={[styles.statusText, { color: VENDOR_RETURN_STATUS_COLORS[vendorReturn.status] }]}>{vendorReturn.status}</Text>
          </View>
        </View>
        {vendorReturn.notes && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Notes:</Text>
            <Text style={styles.detailValue}>{vendorReturn.notes}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Items</Text>
      {items.map(item => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.product_name}</Text>
            {item.reason && <Text style={styles.itemReason}>Reason: {item.reason}</Text>}
          </View>
          <Text style={styles.itemQty}>Qty: {item.return_qty}</Text>
        </View>
      ))}
    </ScrollView>

    <View style={styles.actions}>
      {vendorReturn.status === 'pending' && (
        <>
          <Button title="Confirm Return" variant="success" onPress={onConfirm} loading={isProcessing} disabled={isProcessing} />
          <Button title="Cancel" variant="outline" onPress={onCancel} disabled={isProcessing} />
        </>
      )}
    </View>
  </View>
);
