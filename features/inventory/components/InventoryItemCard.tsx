import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';

export interface InventoryItem {
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  quantity: number;
  lowStockThreshold?: number;
  reorderPoint?: number;
  reorderQty?: number;
  defaultVendorId?: string;
}

interface InventoryItemCardProps {
  item: InventoryItem;
  isEditing: boolean;
  editQuantity: string;
  inventoryLoading: boolean;
  onEditQuantityChange: (value: string) => void;
  onStartEdit: (itemKey: string, currentQuantity: number) => void;
  onCancelEdit: () => void;
  onSaveQuantity: (productId: string, variantId?: string) => void;
  onAdjustQuantity: (productId: string, adjustment: number, variantId?: string) => void;
  onCreatePO?: (productId: string, variantId?: string, reorderQty?: number, vendorId?: string) => void;
}

const LOW_STOCK_THRESHOLD = 10;

const getStockColor = (quantity: number, threshold: number = LOW_STOCK_THRESHOLD): string => {
  if (quantity === 0) return lightColors.error;
  if (quantity <= threshold) return lightColors.warning;
  return lightColors.success;
};

const InventoryItemCard: React.FC<InventoryItemCardProps> = ({
  item,
  isEditing,
  editQuantity,
  inventoryLoading,
  onEditQuantityChange,
  onStartEdit,
  onCancelEdit,
  onSaveQuantity,
  onAdjustQuantity,
  onCreatePO,
}) => {
  const stockColor = getStockColor(item.quantity, item.lowStockThreshold);
  const needsReorder = item.reorderPoint && item.quantity <= item.reorderPoint;

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>
          {item.sku && <Text style={styles.itemSku}>SKU: {item.sku}</Text>}
          {needsReorder && (
            <View style={styles.reorderBadge}>
              <Text style={styles.reorderText}>⚠️ Reorder needed</Text>
            </View>
          )}
        </View>
        <View style={[styles.stockBadge, { backgroundColor: stockColor + '20' }]}>
          <Text style={[styles.stockText, { color: stockColor }]}>
            {item.quantity === 0 ? 'Out of Stock' : `${item.quantity} in stock`}
          </Text>
        </View>
      </View>

      {isEditing ? (
        <View style={styles.editContainer}>
          <Input
            value={editQuantity}
            onChangeText={onEditQuantityChange}
            keyboardType="numeric"
            placeholder="Enter quantity"
            size="sm"
            containerStyle={styles.editInput}
          />
          <Button
            title="Save"
            size="sm"
            variant="success"
            onPress={() => onSaveQuantity(item.productId, item.variantId)}
            loading={inventoryLoading}
          />
          <Button title="Cancel" size="sm" variant="ghost" onPress={onCancelEdit} />
        </View>
      ) : (
        <View style={styles.actionContainer}>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() => onAdjustQuantity(item.productId, -1, item.variantId)}
              disabled={item.quantity === 0}
            >
              <Text style={styles.adjustButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.quantityDisplay}>{item.quantity}</Text>
            <TouchableOpacity style={styles.adjustButton} onPress={() => onAdjustQuantity(item.productId, 1, item.variantId)}>
              <Text style={styles.adjustButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.rightActions}>
            {needsReorder && onCreatePO && (
              <Button
                title="Create PO"
                size="sm"
                variant="primary"
                onPress={() => onCreatePO(item.productId, item.variantId, item.reorderQty, item.defaultVendorId)}
                style={styles.createPOButton}
              />
            )}
            <Button
              title="Edit"
              size="sm"
              variant="outline"
              onPress={() => {
                onStartEdit(`${item.productId}-${item.variantId || ''}`, item.quantity);
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  itemCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.low,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  itemSku: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  stockBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  stockText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: lightColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: typography.fontSize.xl,
    color: lightColors.textOnPrimary,
    fontWeight: '700',
  },
  quantityDisplay: {
    minWidth: 50,
    textAlign: 'center',
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editInput: {
    flex: 1,
    marginBottom: 0,
  },
  reorderBadge: {
    backgroundColor: lightColors.warning + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  reorderText: {
    fontSize: typography.fontSize.xs,
    color: lightColors.warning,
    fontWeight: '600',
  },
  createPOButton: {
    minWidth: 80,
  },
});

export default InventoryItemCard;
