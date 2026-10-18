import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { Button } from '../../../shared/components/Button';
import Input from '../../../shared/components/Input';
import type { ReturnableItem } from './ExchangeReturnItemsStep';

export interface ReturnItemInput {
  orderItemId?: string;
  productId: string;
  variantId?: string;
  productName: string;
  quantity: number;
  refundAmount: number;
  reason?: string;
  restock?: boolean;
}

interface ReturnItemsFormProps {
  orderId: string;
  returnableItems: ReturnableItem[];
  isLoadingReturnable: boolean;
  returnItems: ReturnItemInput[];
  issueRefund: boolean;
  reason: string;
  currencyCode: string;
  onOrderIdChange: (value: string) => void;
  onAddItem: (item: ReturnableItem) => void;
  onRemoveItem: (index: number) => void;
  onUpdateItemQuantity: (index: number, quantity: number) => void;
  onIssueRefundChange: (value: boolean) => void;
  onReasonChange: (value: string) => void;
}

/** Return-with-refund form — order lookup, returnable items, quantity editing, refund toggle. */
export const ReturnItemsForm: React.FC<ReturnItemsFormProps> = ({
  orderId,
  returnableItems,
  isLoadingReturnable,
  returnItems,
  issueRefund,
  reason,
  currencyCode,
  onOrderIdChange,
  onAddItem,
  onRemoveItem,
  onUpdateItemQuantity,
  onIssueRefundChange,
  onReasonChange,
}) => (
  <>
    <Input label="Order ID" placeholder="Enter order ID" value={orderId} onChangeText={onOrderIdChange} required />

    {isLoadingReturnable ? (
      <ActivityIndicator style={styles.returnableLoader} />
    ) : returnableItems.length > 0 ? (
      <>
        <Text style={styles.sectionSubtitle}>Available Items to Return</Text>
        {returnableItems.map(item => (
          <View key={item.orderItemId} style={styles.returnableItem}>
            <View style={styles.returnableItemInfo}>
              <Text style={styles.returnableItemName}>{item.name}</Text>
              <Text style={styles.returnableItemMeta}>
                {item.returnableQuantity} available · {formatMoney(item.price, currencyCode)} each
              </Text>
            </View>
            <Button
              title="Add"
              variant="outline"
              size="sm"
              onPress={() => onAddItem(item)}
              disabled={returnItems.some(ri => ri.orderItemId === item.orderItemId)}
            />
          </View>
        ))}
      </>
    ) : orderId ? (
      <Text style={styles.emptyReturnableText}>No returnable items found for this order</Text>
    ) : null}

    {returnItems.length > 0 && (
      <>
        <Text style={styles.sectionSubtitle}>Items to Return</Text>
        {returnItems.map((item, index) => (
          <View key={index} style={styles.returnItem}>
            <View style={styles.returnItemHeader}>
              <Text style={styles.returnItemName}>{item.productName}</Text>
              <TouchableOpacity onPress={() => onRemoveItem(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={20} color={lightColors.error} />
              </TouchableOpacity>
            </View>
            <View style={styles.returnItemControls}>
              <View style={styles.quantityControl}>
                <TouchableOpacity
                  onPress={() => onUpdateItemQuantity(index, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  style={styles.quantityButton}
                >
                  <MaterialIcons name="remove" size={20} color={item.quantity <= 1 ? lightColors.textSecondary : lightColors.primary} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => onUpdateItemQuantity(index, item.quantity + 1)} style={styles.quantityButton}>
                  <MaterialIcons name="add" size={20} color={lightColors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.returnItemAmount}>{formatMoney(item.refundAmount, currencyCode)}</Text>
            </View>
          </View>
        ))}

        <View style={styles.returnOptionsContainer}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => onIssueRefundChange(!issueRefund)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: issueRefund }}
          >
            <MaterialIcons
              name={issueRefund ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={issueRefund ? lightColors.primary : lightColors.textSecondary}
            />
            <Text style={styles.checkboxLabel}>Issue monetary refund</Text>
          </TouchableOpacity>
        </View>

        <Input
          label="Reason"
          placeholder="Reason for return (optional)"
          value={reason}
          onChangeText={onReasonChange}
          multiline
          numberOfLines={3}
        />
      </>
    )}
  </>
);

const styles = StyleSheet.create({
  sectionSubtitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  returnableLoader: {
    marginVertical: spacing.lg,
  },
  emptyReturnableText: {
    textAlign: 'center',
    marginVertical: spacing.lg,
    color: lightColors.textSecondary,
    fontSize: typography.fontSize.sm,
  },
  returnableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  returnableItemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  returnableItemName: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: lightColors.textPrimary,
    marginBottom: 2,
  },
  returnableItemMeta: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  returnItem: {
    padding: spacing.sm,
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  returnItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  returnItemName: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: lightColors.textPrimary,
    flex: 1,
  },
  returnItemControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.sm,
  },
  quantityText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    minWidth: 30,
    textAlign: 'center',
  },
  returnItemAmount: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  returnOptionsContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
});
