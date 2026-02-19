import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../utils/theme';
import { AuthMethodType, AUTH_METHOD_INFO, getAuthMethodsForMode } from '../../services/auth/AuthMethodInterface';
import { authService } from '../../services/auth/AuthService';
import { authConfig } from '../../services/auth/AuthConfigService';

const AuthMethodSettingsTab: React.FC = () => {
  const [primaryMethod, setPrimaryMethod] = useState<AuthMethodType>('pin');
  const [enabledMethods, setEnabledMethods] = useState<Set<AuthMethodType>>(new Set(['pin']));
  const [availability, setAvailability] = useState<Partial<Record<AuthMethodType, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Methods applicable to the current auth mode
  const applicableMethods = getAuthMethodsForMode(authConfig.authMode);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      setPrimaryMethod(authConfig.primaryMethod);
      setEnabledMethods(new Set(authConfig.allowedMethods));

      // Check availability for applicable methods only
      const result: Partial<Record<AuthMethodType, boolean>> = {};
      for (const method of applicableMethods) {
        const provider = authService.getProvider(method);
        if (provider) {
          if (method === 'pin' || method === 'password' || method === 'platform_auth') {
            result[method] = true;
          } else if (method === 'biometric') {
            result[method] = await provider.isAvailable();
          } else {
            result[method] = true;
          }
        } else {
          result[method] = false;
        }
      }
      setAvailability(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const toggleMethod = (method: AuthMethodType) => {
    // PIN (offline default) and platform_auth (online default) cannot be disabled
    if (method === 'pin' || method === 'platform_auth') return;

    setEnabledMethods(prev => {
      const next = new Set(prev);
      if (next.has(method)) {
        next.delete(method);
        if (primaryMethod === method) {
          setPrimaryMethod('pin');
        }
      } else {
        next.add(method);
      }
      return next;
    });
    setDirty(true);
  };

  const selectPrimary = (method: AuthMethodType) => {
    if (!enabledMethods.has(method)) {
      Alert.alert('Enable First', `Please enable ${AUTH_METHOD_INFO[method].label} before setting it as the default.`);
      return;
    }
    setPrimaryMethod(method);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const methods = Array.from(enabledMethods);
      await authConfig.setAllowedMethods(methods);
      await authConfig.setPrimaryMethod(primaryMethod);

      const magProvider = authService.getProvider('magstripe');
      const rfidProvider = authService.getProvider('rfid_nfc');
      if (magProvider && 'setHardwareAvailable' in magProvider) {
        await (magProvider as any).setHardwareAvailable(enabledMethods.has('magstripe'));
      }
      if (rfidProvider && 'setHardwareAvailable' in rfidProvider) {
        await (rfidProvider as any).setHardwareAvailable(enabledMethods.has('rfid_nfc'));
      }

      setDirty(false);
      Alert.alert('Saved', 'Authentication settings have been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save authentication settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={lightColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Login Methods</Text>
      <Text style={styles.sectionDescription}>Configure how staff log in to the POS. PIN is always available as a fallback.</Text>

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
                {info.requiresHardware && <Text style={styles.hardwareNote}>Requires external hardware</Text>}
                {info.requiresPlatformSupport && !isAvailable && <Text style={styles.hardwareNote}>Not available on this device</Text>}
              </View>
              <Switch
                value={isEnabled}
                onValueChange={() => toggleMethod(method)}
                disabled={isAlwaysOn || !isAvailable}
                trackColor={{ false: lightColors.border, true: lightColors.primary + '60' }}
                thumbColor={isEnabled ? lightColors.primary : lightColors.textSecondary}
              />
            </View>

            {isEnabled && !isPrimary && isAvailable && (
              <TouchableOpacity style={styles.setDefaultButton} onPress={() => selectPrimary(method)}>
                <Text style={styles.setDefaultText}>Set as default login method</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Summary */}
      <View style={styles.summarySection}>
        <Text style={styles.summaryText}>
          <Text style={styles.summaryBold}>Default: </Text>
          {AUTH_METHOD_INFO[primaryMethod].icon} {AUTH_METHOD_INFO[primaryMethod].label}
        </Text>
        <Text style={styles.summaryText}>
          <Text style={styles.summaryBold}>Enabled: </Text>
          {Array.from(enabledMethods)
            .map(m => AUTH_METHOD_INFO[m].label)
            .join(', ')}
        </Text>
      </View>

      {/* Save */}
      {dirty && (
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  // ── Method card ───────────────────────────────────────────────────
  methodCard: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: lightColors.surface,
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
  summarySection: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...elevation.low,
  },
  summaryText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  summaryBold: {
    fontWeight: '600',
  },
  // ── Save ──────────────────────────────────────────────────────────
  saveButton: {
    backgroundColor: lightColors.primary,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontWeight: '600',
  },
});

export default AuthMethodSettingsTab;
