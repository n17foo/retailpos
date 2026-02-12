import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { lightColors, spacing, typography } from '../../utils/theme';
import { InventoryItem } from './InventoryItemCard';

const LOW_STOCK_THRESHOLD = 10;

interface InventoryFilterTabsProps {
  filter: 'all' | 'low' | 'out';
  items: InventoryItem[];
  onFilterChange: (filter: 'all' | 'low' | 'out') => void;
}

const InventoryFilterTabs: React.FC<InventoryFilterTabsProps> = ({ filter, items, onFilterChange }) => {
  const lowStockCount = items.filter(i => i.quantity > 0 && i.quantity <= (i.lowStockThreshold || LOW_STOCK_THRESHOLD)).length;
  const outOfStockCount = items.filter(i => i.quantity === 0).length;

  return (
    <View style={styles.filterTabs}>
      <TouchableOpacity style={[styles.filterTab, filter === 'all' && styles.activeFilterTab]} onPress={() => onFilterChange('all')}>
        <Text style={[styles.filterTabText, filter === 'all' && styles.activeFilterTabText]}>All ({items.length})</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.filterTab, filter === 'low' && styles.activeFilterTab]} onPress={() => onFilterChange('low')}>
        <Text style={[styles.filterTabText, filter === 'low' && styles.activeFilterTabText]}>
          Low Stock ({lowStockCount})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.filterTab, filter === 'out' && styles.activeFilterTab]} onPress={() => onFilterChange('out')}>
        <Text style={[styles.filterTabText, filter === 'out' && styles.activeFilterTabText]}>
          Out of Stock ({outOfStockCount})
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeFilterTab: {
    borderBottomColor: lightColors.primary,
  },
  filterTabText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  activeFilterTabText: {
    color: lightColors.primary,
    fontWeight: '600',
  },
});

export default InventoryFilterTabs;
