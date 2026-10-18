import { StyleSheet } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../../shared/utils/theme';

export type PrinterModelType = 'snbc_orient' | 'epson' | 'star' | 'citizen' | 'generic';

export const PRINTER_MODELS: { value: PrinterModelType; label: string }[] = [
  { value: 'snbc_orient', label: 'SNBC Orient' },
  { value: 'epson', label: 'Epson' },
  { value: 'star', label: 'Star' },
  { value: 'citizen', label: 'Citizen' },
  { value: 'generic', label: 'Generic/Other' },
];

export const PAPER_WIDTHS: { value: 58 | 80; label: string }[] = [
  { value: 58, label: '58mm' },
  { value: 80, label: '80mm' },
];

/** Shared styles for the receipt-settings tab and its section components. */
export const receiptSettingsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  scrollContent: {
    padding: spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: lightColors.textSecondary,
  },
  section: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.md,
  },
  modelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modelOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.background,
  },
  modelOptionSelected: {
    backgroundColor: lightColors.primary,
    borderColor: lightColors.primary,
  },
  modelText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
  modelTextSelected: {
    color: lightColors.surface,
    fontWeight: '600',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: lightColors.primary,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    backgroundColor: lightColors.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: lightColors.surface,
  },
  radioText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: lightColors.background,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  optionLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  toggle: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    backgroundColor: lightColors.divider,
    minWidth: 60,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: lightColors.primary,
  },
  toggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.surface,
  },
  copiesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  copiesButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copiesButtonText: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.surface,
  },
  copiesValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginHorizontal: spacing.lg,
    minWidth: 30,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: lightColors.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    backgroundColor: lightColors.divider,
  },
  saveButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.surface,
  },
  errorContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: `${lightColors.error}20`,
    borderRadius: borderRadius.md,
  },
  errorText: {
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
  },
  spacer: {
    height: spacing.xl,
  },
});
