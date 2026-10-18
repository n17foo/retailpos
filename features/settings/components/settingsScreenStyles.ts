import { StyleSheet } from 'react-native';
import { lightColors, spacing, typography, borderRadius, elevation, semanticColors } from '../../../shared/utils/theme';

/** Shared styles for SettingsScreen and its navigation components. */
export const settingsScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: typography.fontSize.md,
    color: lightColors.primary,
  },
  // ===== Desktop side nav =====
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sideNav: {
    width: 220,
    backgroundColor: lightColors.surface,
    borderRightWidth: 1,
    borderRightColor: lightColors.border,
    paddingTop: spacing.sm,
  },
  sideNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingLeft: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: lightColors.transparent,
  },
  sideNavItemActive: {
    backgroundColor: semanticColors.hover,
    borderLeftColor: lightColors.primary,
  },
  sideNavIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
    width: 24,
    textAlign: 'center',
  },
  sideNavLabelWrapper: {
    flex: 1,
  },
  sideNavLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  sideNavLabelActive: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  sideNavLabelDisabled: {
    color: lightColors.textSecondary,
    opacity: 0.5,
  },
  sideNavSubtitle: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  desktopContent: {
    flex: 1,
    padding: spacing.lg,
  },
  // ===== Mobile dropdown =====
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  dropdownIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  dropdownLabel: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  dropdownArrow: {
    fontSize: 16,
    color: lightColors.textSecondary,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: lightColors.overlay,
    justifyContent: 'flex-start',
    paddingTop: 120,
  },
  dropdownMenu: {
    marginHorizontal: spacing.md,
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    ...elevation.high,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.divider,
  },
  dropdownItemActive: {
    backgroundColor: semanticColors.hover,
  },
  dropdownItemIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
    width: 24,
    textAlign: 'center',
  },
  dropdownItemLabelWrapper: {
    flex: 1,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  dropdownItemTextActive: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  dropdownCheck: {
    color: lightColors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  // ===== Tablet tab bar =====
  tabBarScroll: {
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    flexGrow: 0,
  },
  tabBarContent: {
    paddingHorizontal: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: lightColors.transparent,
  },
  activeTab: {
    borderBottomColor: lightColors.primary,
  },
  tabDisabled: {
    opacity: 0.4,
  },
  tabText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  activeTabText: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: lightColors.background,
  },
  accessDeniedText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
});
