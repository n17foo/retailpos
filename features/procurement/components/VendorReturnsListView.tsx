import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { VendorReturnRow, VendorRow } from '../repositories/ProcurementRepository';
import { vendorReturnStyles as styles, VENDOR_RETURN_STATUS_COLORS } from './vendorReturnStyles';

export type VendorReturnStatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled';

interface VendorReturnsListViewProps {
  returns: VendorReturnRow[];
  vendors: VendorRow[];
  statusFilter: VendorReturnStatusFilter;
  isLoading: boolean;
  onStatusFilterChange: (status: VendorReturnStatusFilter) => void;
  onCreate: () => void;
  onSelectReturn: (vendorReturn: VendorReturnRow) => void;
}

/** Vendor returns list — status filter chips + tappable return cards. */
export const VendorReturnsListView: React.FC<VendorReturnsListViewProps> = ({
  returns,
  vendors,
  statusFilter,
  isLoading,
  onStatusFilterChange,
  onCreate,
  onSelectReturn,
}) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>Vendor Returns</Text>
      <TouchableOpacity onPress={onCreate} style={styles.createButton}>
        <MaterialIcons name="add" size={24} color={lightColors.surface} />
      </TouchableOpacity>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
      {(['all', 'pending', 'confirmed', 'cancelled'] as VendorReturnStatusFilter[]).map(status => (
        <TouchableOpacity
          key={status}
          style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
          onPress={() => onStatusFilterChange(status)}
        >
          <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
            {status === 'all' ? 'All' : status}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>

    {isLoading ? (
      <ActivityIndicator size="large" color={lightColors.primary} style={styles.loader} />
    ) : returns.length === 0 ? (
      <View style={styles.emptyState}>
        <MaterialIcons name="assignment-return" size={64} color={lightColors.textHint} />
        <Text style={styles.emptyText}>No vendor returns found</Text>
      </View>
    ) : (
      <FlatList
        data={returns}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const vendor = vendors.find(v => v.id === item.vendor_id);
          return (
            <TouchableOpacity style={styles.card} onPress={() => onSelectReturn(item)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{vendor?.name ?? 'Unknown Vendor'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: VENDOR_RETURN_STATUS_COLORS[item.status] + '20' }]}>
                  <Text style={[styles.statusText, { color: VENDOR_RETURN_STATUS_COLORS[item.status] }]}>{item.status}</Text>
                </View>
              </View>
              {item.notes && <Text style={styles.cardNotes}>{item.notes}</Text>}
              <Text style={styles.cardDate}>Created: {new Date(item.created_at).toLocaleDateString()}</Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContent}
      />
    )}
  </View>
);
