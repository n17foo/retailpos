import { StyleSheet } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation, semanticColors } from '../../../shared/utils/theme';

/** Shared styles for the offline-setup onboarding step and its sections. */
export const offlineSetupStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
    color: lightColors.textPrimary,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: semanticColors.infoBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: lightColors.primary,
  },
  infoTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: semanticColors.infoText,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
    backgroundColor: lightColors.surface,
    marginBottom: spacing.sm,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  currencyChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  currencyChipActive: {
    backgroundColor: lightColors.primary,
    borderColor: lightColors.primary,
  },
  currencyText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textSecondary,
  },
  currencyTextActive: {
    color: lightColors.textOnPrimary,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  addInput: {
    flex: 1,
    marginBottom: 0,
  },
  addButton: {
    backgroundColor: lightColors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
    fontSize: typography.fontSize.sm,
  },
  categoryCard: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: lightColors.surface,
    ...elevation.low,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 12,
    color: lightColors.textSecondary,
  },
  categoryName: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  productCount: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  removeText: {
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  categoryBody: {
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    padding: spacing.md,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    marginBottom: spacing.xs,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textPrimary,
  },
  productPrice: {
    fontSize: typography.fontSize.sm,
    color: lightColors.success,
    fontWeight: '600',
  },
  productSku: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  addProductForm: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  productInput: {
    marginBottom: spacing.xs,
  },
  priceSkuRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priceInput: {
    flex: 1,
  },
  skuInput: {
    flex: 1,
  },
  addProductButton: {
    backgroundColor: lightColors.success,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  addProductButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
    fontSize: typography.fontSize.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: lightColors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    paddingVertical: spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  backButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  backButtonText: {
    color: lightColors.textSecondary,
    fontWeight: '600',
    fontSize: typography.fontSize.md,
  },
  nextButton: {
    flex: 2,
    backgroundColor: lightColors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  nextButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
    fontSize: typography.fontSize.md,
  },
});
