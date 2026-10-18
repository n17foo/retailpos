import { StyleSheet } from 'react-native';
import { lightColors, spacing, borderRadius, typography, semanticColors } from '../../../shared/utils/theme';

/**
 * Shared field-row styles for settings tabs and their extracted sub-components
 * (label + input/toggle/radio rows, info boxes). Keep visual parity with the
 * styles previously inlined in each settings tab.
 */
export const settingsFieldStyles = StyleSheet.create({
  optionRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.divider,
  },
  label: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  input: {
    flex: 2,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    backgroundColor: lightColors.surface,
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
  toggleButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center' as const,
  },
  toggleActive: {
    backgroundColor: lightColors.success,
    borderColor: lightColors.success,
  },
  toggleInactive: {
    backgroundColor: lightColors.background,
    borderColor: lightColors.border,
  },
  toggleText: {
    color: lightColors.textPrimary,
    fontWeight: typography.fontWeight.semiBold as '600',
    fontSize: typography.fontSize.sm,
  },
  toggleActiveText: {
    color: lightColors.textOnPrimary,
  },
  disabled: {
    opacity: 0.6,
  },
  radioContainer: {
    marginTop: spacing.xs,
  },
  radioWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.sm,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: lightColors.primary,
    marginRight: spacing.sm,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: lightColors.primary,
  },
  radioLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  infoBox: {
    backgroundColor: semanticColors.infoBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: lightColors.primary,
  },
  infoTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold as '600',
    color: semanticColors.infoText,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    lineHeight: 20,
  },
});
