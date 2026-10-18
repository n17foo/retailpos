import { StyleSheet } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation, semanticColors } from '../../../shared/utils/theme';

/** Shared styles for the checkout modal and its step views. */
export const checkoutModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: lightColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    ...elevation.high,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    textAlign: 'center',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lightColors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 18,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lightColors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  content: {
    padding: spacing.md,
  },
  summaryCard: {
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  orderRef: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  totalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.primary,
  },
  loyaltyInfo: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  loyaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  loyaltyIcon: {
    fontSize: typography.fontSize.md,
    marginRight: spacing.xs,
  },
  loyaltyText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.sm,
  },
  paymentMethods: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  paymentOptionSelected: {
    borderColor: lightColors.primary,
    backgroundColor: semanticColors.infoBackground,
  },
  paymentOptionDisabled: {
    opacity: 0.5,
  },
  paymentIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  paymentLabelSelected: {
    color: lightColors.primary,
  },
  paymentDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 20,
    color: lightColors.primary,
    fontWeight: '700',
  },
  actions: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    gap: spacing.sm,
  },
  // ── Cash tendering ──────────────────────────────────────────────────────
  amountDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  amountDueLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  amountDueValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  tenderedDisplay: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    marginBottom: spacing.sm,
  },
  tenderedLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  tenderedValue: {
    fontSize: 40,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  tenderedPlaceholder: {
    color: lightColors.textHint,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  changePositive: {
    backgroundColor: lightColors.success + '20',
  },
  changeInsufficient: {
    backgroundColor: lightColors.error + '15',
  },
  changeLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  changeValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickAmountButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.primary,
    backgroundColor: lightColors.surface,
  },
  quickAmountText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.primary,
  },
  keypadWrapper: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  // ── Split tender ────────────────────────────────────────────────────────
  splitLinesContainer: {
    marginBottom: spacing.sm,
  },
  splitLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  splitLineMethod: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    fontWeight: '500',
  },
  splitLineAmount: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginRight: spacing.sm,
  },
  splitLineRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: lightColors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitLineRemoveText: {
    fontSize: 14,
    color: lightColors.error,
    fontWeight: '700',
  },
  splitTotalsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  splitTotalItem: {
    flex: 1,
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  splitTotalLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  splitTotalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  splitAddSection: {
    marginBottom: spacing.md,
  },
  splitMethodRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  splitMethodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    alignItems: 'center',
  },
  splitMethodButtonSelected: {
    borderColor: lightColors.primary,
    backgroundColor: semanticColors.infoBackground,
  },
  splitMethodButtonText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '500',
  },
  splitMethodButtonTextSelected: {
    color: lightColors.primary,
    fontWeight: '700',
  },
  splitAmountInput: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.surface,
    marginBottom: spacing.sm,
  },
  errorBanner: {
    fontSize: typography.fontSize.sm,
    color: lightColors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
});
