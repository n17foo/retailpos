import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../utils/theme';
import { AuthMethodType, AuthMode, AUTH_METHOD_INFO, getAuthMethodsForMode } from '../../services/auth/AuthMethodInterface';
import { authService } from '../../services/auth/AuthService';
import { authConfig } from '../../services/auth/AuthConfigService';
import { isOnlinePlatform, ECommercePlatform } from '../../utils/platforms';

interface AuthMethodSetupStepProps {
  onBack: () => void;
  onComplete: () => void;
  /** The platform selected during onboarding (e.g. 'shopify', 'offline') */
  selectedPlatform: string | null;
}

const AuthMethodSetupStep: React.FC<AuthMethodSetupStepProps> = ({ onBack, onComplete, selectedPlatform }) => {
  // Determine mode from selected platform
  const authMode: AuthMode =
    selectedPlatform && selectedPlatform !== 'offline' && isOnlinePlatform(selectedPlatform as ECommercePlatform) ? 'online' : 'offline';

  // Only show methods compatible with the current mode
  const applicableMethods = getAuthMethodsForMode(authMode);

  const defaultPrimary: AuthMethodType = authMode === 'online' ? 'platform_auth' : 'pin';
  const [primaryMethod, setPrimaryMethod] = useState<AuthMethodType>(defaultPrimary);
  const [enabledMethods, setEnabledMethods] = useState<Set<AuthMethodType>>(new Set([defaultPrimary]));
  const [availability, setAvailability] = useState<Partial<Record<AuthMethodType, boolean>>>({});
  const [saving, setSaving] = useState(false);

  // Check which methods are available on this device
  useEffect(() => {
    const checkAvailability = async () => {
      const result: Partial<Record<AuthMethodType, boolean>> = {};
      for (const method of applicableMethods) {
        const provider = authService.getProvider(method);
        if (provider) {
          if (method === 'pin' || method === 'password' || method === 'platform_auth') {
            result[method] = true;
          } else if (method === 'biometric') {
            result[method] = await provider.isAvailable();
          } else {
            // Hardware methods — always show in setup, user toggles to declare they have the reader
            result[method] = true;
          }
        } else {
          result[method] = false;
        }
      }
      setAvailability(result);
    };
    checkAvailability();
  }, [authMode]);

  const toggleMethod = (method: AuthMethodType) => {
    // PIN (offline default) and platform_auth (online default) cannot be disabled
    if (method === 'pin' || method === 'platform_auth') return;

    setEnabledMethods(prev => {
      const next = new Set(prev);
      if (next.has(method)) {
        next.delete(method);
        // If we just disabled the primary, reset to PIN
        if (primaryMethod === method) {
          setPrimaryMethod('pin');
        }
      } else {
        next.add(method);
      }
      return next;
    });
  };

  const selectPrimary = (method: AuthMethodType) => {
    if (!enabledMethods.has(method)) {
      Alert.alert('Enable First', `Please enable ${AUTH_METHOD_INFO[method].label} before setting it as the default.`);
      return;
    }
    setPrimaryMethod(method);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist the auth mode
      await authConfig.setAuthMode(authMode);

      const methods = Array.from(enabledMethods);
      await authConfig.setAllowedMethods(methods);
      await authConfig.setPrimaryMethod(primaryMethod);

      // For hardware methods, mark them as available if enabled
      const magProvider = authService.getProvider('magstripe');
      const rfidProvider = authService.getProvider('rfid_nfc');
      if (magProvider && 'setHardwareAvailable' in magProvider) {
        await (magProvider as unknown as { setHardwareAvailable: (v: boolean) => Promise<void> }).setHardwareAvailable(
          enabledMethods.has('magstripe')
        );
      }
      if (rfidProvider && 'setHardwareAvailable' in rfidProvider) {
        await (rfidProvider as unknown as { setHardwareAvailable: (v: boolean) => Promise<void> }).setHardwareAvailable(
          enabledMethods.has('rfid_nfc')
        );
      }

      onComplete();
    } catch (err) {
      Alert.alert('Error', 'Failed to save authentication settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Authentication Setup</Text>
      <Text style={styles.subtitle}>
        {authMode === 'online'
          ? "You are using an online e-commerce platform. Platform Login authenticates via your platform's API. You can also enable local methods as fallback."
          : 'Choose how staff will log in to the POS. PIN is always available as a fallback. You can enable multiple methods.'}
      </Text>

      {/* Auth methods list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Methods</Text>

        {applicableMethods.map(method => {
          const info = AUTH_METHOD_INFO[method];
          const isEnabled = enabledMethods.has(method);
          const isAvailable = availability[method] ?? false;
          const isPrimary = primaryMethod === method;
          const isPin = method === 'pin';
          const isPlatformAuth = method === 'platform_auth';
          const isAlwaysOn = isPin || isPlatformAuth;

          return (
            <View key={method} style={[styles.methodCard, !isAvailable && styles.methodCardDisabled]}>
              <View style={styles.methodHeader}>
                <Text style={styles.methodIcon}>{info.icon}</Text>
                <View style={styles.methodInfo}>
                  <View style={styles.methodTitleRow}>
                    <Text style={[styles.methodLabel, !isAvailable && styles.methodLabelDisabled]}>{info.label}</Text>
                    {isPrimary && <Text style={styles.primaryBadge}>DEFAULT</Text>}
                    {isAlwaysOn && <Text style={styles.alwaysOnBadge}>ALWAYS ON</Text>}
                  </View>
                  <Text style={styles.methodDescription}>{info.description}</Text>
                  {info.requiresHardware && <Text style={styles.hardwareNote}>⚠️ Requires external hardware</Text>}
                  {info.requiresPlatformSupport && !isAvailable && <Text style={styles.hardwareNote}>⚠️ Not available on this device</Text>}
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={() => toggleMethod(method)}
                  disabled={isAlwaysOn || !isAvailable}
                  trackColor={{ false: lightColors.border, true: lightColors.primary + '60' }}
                  thumbColor={isEnabled ? lightColors.primary : lightColors.textSecondary}
                />
              </View>

              {/* Set as default button */}
              {isEnabled && !isPrimary && isAvailable && (
                <TouchableOpacity style={styles.setDefaultButton} onPress={() => selectPrimary(method)}>
                  <Text style={styles.setDefaultText}>Set as default login method</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.summaryText}>
          <Text style={styles.summaryBold}>Default method: </Text>
          {AUTH_METHOD_INFO[primaryMethod].icon} {AUTH_METHOD_INFO[primaryMethod].label}
        </Text>
        <Text style={styles.summaryText}>
          <Text style={styles.summaryBold}>Enabled methods: </Text>
          {Array.from(enabledMethods)
            .map(m => AUTH_METHOD_INFO[m].label)
            .join(', ')}
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nextButton, saving && styles.nextButtonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.nextButtonText}>{saving ? 'Saving…' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  title: {
    fontSize: typography.fontSize.xl + 4,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
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
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.md,
  },
  // ── Method card ───────────────────────────────────────────────────
  methodCard: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: lightColors.background,
  },
  methodCardDisabled: {
    opacity: 0.5,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  methodIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  methodInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: 4,
  },
  methodLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  methodLabelDisabled: {
    color: lightColors.textSecondary,
  },
  methodDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    lineHeight: 20,
  },
  hardwareNote: {
    fontSize: typography.fontSize.xs,
    color: lightColors.warning,
    marginTop: 4,
  },
  primaryBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: lightColors.primary,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  alwaysOnBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: lightColors.textSecondary,
    backgroundColor: lightColors.border,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  setDefaultButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: lightColors.divider,
  },
  setDefaultText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '600',
  },
  // ── Summary ───────────────────────────────────────────────────────
  summaryText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  summaryBold: {
    fontWeight: '600',
  },
  // ── Buttons ───────────────────────────────────────────────────────
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  backButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textSecondary,
  },
  nextButton: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.primary,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AuthMethodSetupStep;
