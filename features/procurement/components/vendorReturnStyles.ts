import { StyleSheet } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../../shared/utils/theme';

export const VENDOR_RETURN_STATUS_COLORS: Record<string, string> = {
  pending: lightColors.warning,
  confirmed: lightColors.success,
  cancelled: lightColors.error,
};

/** Shared styles for the vendor-returns views (list / detail / create). */
export const vendorReturnStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
  },
  headerSpacer: {
    width: 40,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: lightColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: lightColors.surface,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    backgroundColor: lightColors.inputBackground,
    marginRight: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: lightColors.primary,
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: lightColors.surface,
    fontWeight: '600',
  },
  loader: {
    marginTop: spacing.xl,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginTop: spacing.md,
  },
  listContent: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.low,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardNotes: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  cardDate: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textHint,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  detailCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.sm,
  },
  itemCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    marginBottom: 2,
  },
  itemReason: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    fontStyle: 'italic',
  },
  itemQty: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  actions: {
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  pickerContainer: {
    marginBottom: spacing.md,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    backgroundColor: lightColors.surface,
  },
  pickerText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  pickerPlaceholder: {
    fontSize: typography.fontSize.md,
    color: lightColors.textHint,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.surface,
    marginBottom: spacing.md,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  returnItemCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  returnItemInfo: {
    marginBottom: spacing.xs,
  },
  returnItemName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: 2,
  },
  returnItemReceived: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  returnItemInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  qtyInput: {
    width: 80,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    backgroundColor: lightColors.inputBackground,
  },
  reasonInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    fontSize: typography.fontSize.sm,
    backgroundColor: lightColors.inputBackground,
  },
});
