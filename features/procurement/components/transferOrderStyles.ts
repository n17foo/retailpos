import { StyleSheet } from 'react-native';
import { lightColors, spacing, borderRadius, typography } from '../../../shared/utils/theme';

export const TRANSFER_STATUS_COLORS: Record<string, string> = {
  draft: lightColors.textSecondary,
  in_transit: lightColors.info,
  received: lightColors.success,
  cancelled: lightColors.error,
};

/** Transfer-order styles — extends the shared vendorReturnStyles base. */
export const transferOrderStyles = StyleSheet.create({
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addProductText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '600',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  productInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  productName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
  qtyInput: {
    width: 60,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  itemName: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    flex: 1,
  },
});
