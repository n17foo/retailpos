import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { TransferOrderRow } from '../repositories/ProcurementRepository';
import { vendorReturnStyles as styles } from './vendorReturnStyles';
import { TRANSFER_STATUS_COLORS } from './transferOrderStyles';

export type TransferStatusFilter = 'all' | 'draft' | 'in_transit' | 'received' | 'cancelled';

interface TransferOrdersListViewProps {
  transfers: TransferOrderRow[];
  statusFilter: TransferStatusFilter;
  isLoading: boolean;
  onStatusFilterChange: (status: TransferStatusFilter) => void;
  onCreate: () => void;
  onSelectTransfer: (transfer: TransferOrderRow) => void;
}

/** Transfer orders list — status filter chips + tappable transfer cards. */
export const TransferOrdersListView: React.FC<TransferOrdersListViewProps> = ({
  transfers,
  statusFilter,
  isLoading,
  onStatusFilterChange,
  onCreate,
  onSelectTransfer,
}) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>Transfer Orders</Text>
      <TouchableOpacity onPress={onCreate} style={styles.createButton}>
        <MaterialIcons name="add" size={24} color={lightColors.surface} />
      </TouchableOpacity>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
      {(['all', 'draft', 'in_transit', 'received', 'cancelled'] as TransferStatusFilter[]).map(status => (
        <TouchableOpacity
          key={status}
          style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
          onPress={() => onStatusFilterChange(status)}
        >
          <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
            {status === 'all' ? 'All' : status.replace('_', ' ')}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>

    {isLoading ? (
      <ActivityIndicator size="large" color={lightColors.primary} style={styles.loader} />
    ) : transfers.length === 0 ? (
      <View style={styles.emptyState}>
        <MaterialIcons name="swap-horiz" size={64} color={lightColors.textHint} />
        <Text style={styles.emptyText}>No transfer orders found</Text>
      </View>
    ) : (
      <FlatList
        data={transfers}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelectTransfer(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {item.from_location} → {item.to_location}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: TRANSFER_STATUS_COLORS[item.status] + '20' }]}>
                <Text style={[styles.statusText, { color: TRANSFER_STATUS_COLORS[item.status] }]}>{item.status.replace('_', ' ')}</Text>
              </View>
            </View>
            {item.notes && <Text style={styles.cardNotes}>{item.notes}</Text>}
            <Text style={styles.cardDate}>Created: {new Date(item.created_at).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />
    )}
  </View>
);
