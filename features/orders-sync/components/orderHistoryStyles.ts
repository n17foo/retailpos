import { StyleSheet } from 'react-native';
import { lightColors, spacing, typography, borderRadius } from '../../../shared/utils/theme';

/** Shared styles for OrderHistoryScreen and its components. */
export const orderHistoryStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  shiftBadgeText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: lightColors.success,
  },
  // Date navigation
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
  },
  dateNavButton: {
    padding: spacing.xs,
  },
  dateNavButtonDisabled: {
    opacity: 0.4,
  },
  dateNavText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    paddingHorizontal: spacing.md,
    minWidth: 140,
    textAlign: 'center',
  },
  // Actions
  actionBar: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shiftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  closeShiftButton: {
    backgroundColor: lightColors.warning,
  },
  shiftButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.surface,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  reportButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.primary,
  },
  // Queue status
  queueStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: lightColors.primary + '10',
    borderRadius: borderRadius.md,
  },
  queueText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '500',
  },
  // Delete button (admin only)
  deleteOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
    paddingVertical: spacing.xs,
    backgroundColor: lightColors.error + '10',
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
  },
  deleteOrderText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.error,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
  emptyList: {
    flex: 1,
  },
});
