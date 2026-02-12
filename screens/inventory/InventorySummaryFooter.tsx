import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { lightColors, spacing, typography } from '../../utils/theme';
import { InventoryItem } from './InventoryItemCard';

const LOW_STOCK_THRESHOLD = 10;

interface InventorySummaryFooterProps {
  items: InventoryItem[];
}

const InventorySummaryFooter: React.FC<InventorySummaryFooterProps> = ({ items }) => {
  if (items.length === 0) return null;

  const lowStockCount = items.filter(i => i.quantity > 0 && i.quantity <= (i.lowStockThreshold || LOW_STOCK_THRESHOLD)).length;
  const outOfStockCount = items.filter(i => i.quantity === 0).length;

  return (
    <View style={styles.footer}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Total Products</Text>
        <Text style={styles.summaryValue}>{items.length}</Text>
      </View>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Low Stock</Text>
        <Text style={[styles.summaryValue, { color: lightColors.warning }]}>{lowStockCount}</Text>
      </View>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Out of Stock</Text>
        <Text style={[styles.summaryValue, { color: lightColors.error }]}>{outOfStockCount}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
});

export default InventorySummaryFooter;
