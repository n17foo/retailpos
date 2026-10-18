import { StyleSheet } from 'react-native';
import { lightColors, spacing, typography, borderRadius } from '../../../shared/utils/theme';

/** Shared styles for LoginScreen and its auth-method forms. */
export const loginScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: spacing.xxl * 1.6,
  },
  logoText: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: '700',
    color: lightColors.primary,
  },
  tagline: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginTop: spacing.sm,
  },
  authContainer: {
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  authTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  authDescription: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: lightColors.error + '15',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'stretch',
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: lightColors.error,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: lightColors.surface + 'CC',
    borderRadius: borderRadius.md,
  },
  // ── Password ──────────────────────────────────────────────────────
  passwordInput: {
    width: '80%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: typography.fontSize.lg,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.surface,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  submitButton: {
    backgroundColor: lightColors.primary,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl * 2,
    borderRadius: borderRadius.md,
  },
  submitButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
  },
  // ── Biometric ─────────────────────────────────────────────────────
  biometricButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    borderRadius: borderRadius.round,
    backgroundColor: lightColors.surface,
    borderWidth: 2,
    borderColor: lightColors.primary,
    marginBottom: spacing.md,
  },
  waitingIconContainer: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  biometricButtonText: {
    fontSize: typography.fontSize.xs,
    color: lightColors.primary,
    fontWeight: '600',
  },
  // ── Card / Badge ──────────────────────────────────────────────────
  waitingText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginTop: spacing.sm,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  // ── Method switcher ───────────────────────────────────────────────
  methodSwitcher: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  switcherLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  switcherRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  switcherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  switcherButtonActive: {
    borderColor: lightColors.primary,
    backgroundColor: lightColors.primary + '15',
  },
  switcherIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  switcherText: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  switcherTextActive: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  // ── Footer ────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  footerText: {
    color: lightColors.textHint,
  },
});
