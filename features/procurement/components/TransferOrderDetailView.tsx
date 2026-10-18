import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import { TransferOrderRow, TransferOrderItemRow } from '../repositories/ProcurementRepository';
import { vendorReturnStyles as styles } from './vendorReturnStyles';
import { transferOrderStyles, TRANSFER_STATUS_COLORS } from './transferOrderStyles';

interface TransferOrderDetailViewProps {
  transfer: TransferOrderRow;
  items: TransferOrderItemRow[];
  isProcessing: boolean;
  onBack: () => void;
  onDispatch: () => void;
  onReceive: () => void;
  onCancel: () => void;
}

/** Single transfer order — route/status card, line items, dispatch/receive/cancel actions. */
export const TransferOrderDetailView: React.FC<TransferOrderDetailViewProps> = ({
  transfer,
  items,
  isProcessing,
  onBack,
  onDispatch,
  onReceive,
  onCancel,
}) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={lightColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title}>Transfer Details</Text>
      <View style={styles.headerSpacer} />
    </View>

    <ScrollView style={styles.content}>
      <View style={styles.detailCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>From:</Text>
          <Text style={styles.detailValue}>{transfer.from_location}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>To:</Text>
          <Text style={styles.detailValue}>{transfer.to_location}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: TRANSFER_STATUS_COLORS[transfer.status] + '20' }]}>
            <Text style={[styles.statusText, { color: TRANSFER_STATUS_COLORS[transfer.status] }]}>{transfer.status.replace('_', ' ')}</Text>
          </View>
        </View>
        {transfer.notes && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Notes:</Text>
            <Text style={styles.detailValue}>{transfer.notes}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Items</Text>
      {items.map(item => (
        <View key={item.id} style={styles.itemCard}>
          <Text style={transferOrderStyles.itemName}>{item.product_name}</Text>
          <Text style={styles.itemQty}>Qty: {item.transfer_qty}</Text>
        </View>
      ))}
    </ScrollView>

    <View style={styles.actions}>
      {transfer.status === 'draft' && (
        <>
          <Button title="Dispatch" variant="primary" onPress={onDispatch} loading={isProcessing} disabled={isProcessing} />
          <Button title="Cancel" variant="outline" onPress={onCancel} disabled={isProcessing} />
        </>
      )}
      {transfer.status === 'in_transit' && (
        <Button title="Receive" variant="success" onPress={onReceive} loading={isProcessing} disabled={isProcessing} />
      )}
    </View>
  </View>
);
