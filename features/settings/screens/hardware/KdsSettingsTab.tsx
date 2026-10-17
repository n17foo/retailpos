import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../../../shared/utils/theme';
import { kdsServiceFactory, KdsSettings, KdsType } from '../../../hardware/services/kds/KdsServiceFactory';
import { KDS_VENDOR_PRESETS, KdsVendorType } from '../../../hardware/services/kds/KdsVendorPresets';
import { useLogger } from '../../../../shared/hooks/useLogger';

const KDS_TYPES: { value: KdsType; label: string; description: string }[] = [
  { value: 'http', label: 'HTTP / REST', description: 'Send tickets via REST API. Compatible with Square KDS and custom servers.' },
  { value: 'websocket', label: 'WebSocket', description: 'Real-time push over WebSocket. Coming soon.' },
  { value: 'electron', label: 'Second Screen', description: 'Display on a second monitor via Electron IPC. Coming soon.' },
];

export const KdsSettingsTab: React.FC = () => {
  const logger = useLogger('KdsSettingsTab');

  const [enabled, setEnabled] = useState(false);
  const [type, setType] = useState<KdsType>('http');
  const [vendor, setVendor] = useState<KdsVendorType>('custom');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [pollIntervalMs, setPollIntervalMs] = useState('3000');
  const [merchantId, setMerchantId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    const settings = kdsServiceFactory.getSettings?.();
    if (settings) {
      setEnabled(settings.enabled);
      setType(settings.type);
      setVendor(settings.vendor);
      setEndpoint(settings.endpoint);
      setApiKey(settings.apiKey);
      setAutoReconnect(settings.autoReconnect);
      setPollIntervalMs(settings.pollIntervalMs?.toString() || '3000');
      setMerchantId(settings.merchantId || '');
    }
  }, []);

  const markDirty = () => setDirty(true);

  const handleSave = useCallback(async () => {
    if (enabled && type !== 'none' && !endpoint.trim()) {
      Alert.alert('Validation Error', 'Endpoint URL is required when KDS is enabled.');
      return;
    }

    setSaving(true);
    try {
      const settings: KdsSettings = {
        enabled,
        type,
        vendor,
        endpoint: endpoint.trim(),
        apiKey: apiKey.trim(),
        autoReconnect,
        pollIntervalMs: parseInt(pollIntervalMs, 10) || 3000,
        merchantId: merchantId.trim() || undefined,
      };
      const connected = await kdsServiceFactory.configure(settings);
      setDirty(false);
      if (enabled && type !== 'none') {
        if (connected) {
          setConnectionStatus('connected');
          Alert.alert('Saved', 'KDS settings saved and connected successfully.');
        } else {
          setConnectionStatus('failed');
          Alert.alert('Saved', 'Settings saved but could not connect to KDS. Will retry automatically.');
        }
      } else {
        Alert.alert('Saved', 'KDS disabled.');
      }
    } catch (err) {
      logger.error({ message: 'Failed to save KDS settings' }, err instanceof Error ? err : new Error(String(err)));
      Alert.alert('Error', 'Failed to save KDS settings.');
    } finally {
      setSaving(false);
    }
  }, [enabled, type, vendor, endpoint, apiKey, autoReconnect, pollIntervalMs, merchantId, logger]);

  const handleTestConnection = useCallback(async () => {
    if (!endpoint.trim()) {
      Alert.alert('Validation Error', 'Enter an endpoint URL before testing.');
      return;
    }
    setConnectionStatus('testing');
    try {
      const service = kdsServiceFactory.getService();
      const ok = service.isConnected() || (await service.connect({ endpoint: endpoint.trim(), apiKey: apiKey.trim() }));
      setConnectionStatus(ok ? 'connected' : 'failed');
      Alert.alert(ok ? 'Connected' : 'Failed', ok ? 'KDS is reachable.' : 'Could not reach the KDS endpoint.');
    } catch {
      setConnectionStatus('failed');
      Alert.alert('Failed', 'Could not reach the KDS endpoint.');
    }
  }, [endpoint, apiKey]);

  const statusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <MaterialIcons name="check-circle" size={18} color={lightColors.success} />;
      case 'failed':
        return <MaterialIcons name="error" size={18} color={lightColors.error} />;
      case 'testing':
        return <ActivityIndicator size="small" color={lightColors.primary} />;
      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Kitchen Display System</Text>
      <Text style={styles.subtitle}>
        Send order tickets to a kitchen display when payment completes. Tickets are delivered via the sync service with automatic retry.
      </Text>

      {/* Enable toggle */}
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.label}>Enable KDS</Text>
            <Text style={styles.hint}>Send tickets to kitchen after each paid order</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={v => {
              setEnabled(v);
              markDirty();
            }}
            trackColor={{ false: lightColors.border, true: lightColors.primary + '60' }}
            thumbColor={enabled ? lightColors.primary : lightColors.textSecondary}
          />
        </View>
      </View>

      {enabled && (
        <>
          {/* KDS type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connection Type</Text>
            {KDS_TYPES.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.typeCard, type === opt.value && styles.typeCardActive]}
                onPress={() => {
                  setType(opt.value);
                  markDirty();
                }}
                disabled={opt.value === 'websocket' || opt.value === 'electron'}
              >
                <View style={styles.typeCardContent}>
                  <Text style={[styles.typeLabel, type === opt.value && styles.typeLabelActive]}>
                    {opt.label}
                    {(opt.value === 'websocket' || opt.value === 'electron') && <Text style={styles.comingSoon}> (coming soon)</Text>}
                  </Text>
                  <Text style={styles.typeDesc}>{opt.description}</Text>
                </View>
                {type === opt.value && <MaterialIcons name="check-circle" size={20} color={lightColors.primary} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* KDS Vendor */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>KDS Vendor</Text>
            <Text style={styles.hint}>Select your kitchen display system vendor for optimized API endpoints</Text>

            {(Object.keys(KDS_VENDOR_PRESETS) as KdsVendorType[]).map(vendorKey => {
              const preset = KDS_VENDOR_PRESETS[vendorKey];
              return (
                <TouchableOpacity
                  key={vendorKey}
                  style={[styles.typeCard, vendor === vendorKey && styles.typeCardActive]}
                  onPress={() => {
                    setVendor(vendorKey);
                    setPollIntervalMs(preset.defaultPollIntervalMs.toString());
                    markDirty();
                  }}
                >
                  <View style={styles.typeCardContent}>
                    <Text style={[styles.typeLabel, vendor === vendorKey && styles.typeLabelActive]}>{preset.name}</Text>
                    <Text style={styles.typeDesc}>{preset.description}</Text>
                  </View>
                  {vendor === vendorKey && <MaterialIcons name="check-circle" size={20} color={lightColors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Connection details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connection Details</Text>

            <Text style={styles.fieldLabel}>Endpoint URL *</Text>
            <TextInput
              style={styles.input}
              value={endpoint}
              onChangeText={v => {
                setEndpoint(v);
                markDirty();
              }}
              placeholder="http://192.168.1.50:8080"
              placeholderTextColor={lightColors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {KDS_VENDOR_PRESETS[vendor].requiresApiKey && (
              <>
                <Text style={styles.fieldLabel}>API Key *</Text>
                <TextInput
                  style={styles.input}
                  value={apiKey}
                  onChangeText={v => {
                    setApiKey(v);
                    markDirty();
                  }}
                  placeholder="Required for this vendor"
                  placeholderTextColor={lightColors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </>
            )}

            {vendor === 'clover' && (
              <>
                <Text style={styles.fieldLabel}>Merchant ID *</Text>
                <TextInput
                  style={styles.input}
                  value={merchantId}
                  onChangeText={v => {
                    setMerchantId(v);
                    markDirty();
                  }}
                  placeholder="Your Clover merchant ID"
                  placeholderTextColor={lightColors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Poll Interval (ms)</Text>
            <TextInput
              style={styles.input}
              value={pollIntervalMs}
              onChangeText={v => {
                setPollIntervalMs(v);
                markDirty();
              }}
              placeholder="3000"
              placeholderTextColor={lightColors.textSecondary}
              keyboardType="numeric"
            />
            <Text style={styles.hint}>
              How often to check for status updates (default: {KDS_VENDOR_PRESETS[vendor].defaultPollIntervalMs}ms)
            </Text>

            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <Text style={styles.label}>Auto-reconnect</Text>
                <Text style={styles.hint}>Reconnect automatically if connection drops</Text>
              </View>
              <Switch
                value={autoReconnect}
                onValueChange={v => {
                  setAutoReconnect(v);
                  markDirty();
                }}
                trackColor={{ false: lightColors.border, true: lightColors.primary + '60' }}
                thumbColor={autoReconnect ? lightColors.primary : lightColors.textSecondary}
              />
            </View>
          </View>

          {/* Test connection */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.testButton} onPress={handleTestConnection} disabled={connectionStatus === 'testing'}>
              {connectionStatus === 'testing' ? (
                <ActivityIndicator size="small" color={lightColors.textOnPrimary} />
              ) : (
                <MaterialIcons name="wifi-tethering" size={18} color={lightColors.textOnPrimary} />
              )}
              <Text style={styles.testButtonText}>Test Connection</Text>
            </TouchableOpacity>

            {connectionStatus !== 'idle' && (
              <View style={styles.statusRow}>
                {statusIcon()}
                <Text style={[styles.statusText, connectionStatus === 'connected' ? styles.statusOk : styles.statusFail]}>
                  {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'failed' ? 'Connection failed' : 'Testing…'}
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Save */}
      {dirty && (
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={lightColors.textOnPrimary} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lightColors.background },
  content: { paddingBottom: spacing.xl * 2 },
  title: { fontSize: typography.fontSize.lg, fontWeight: '600', color: lightColors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  section: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  sectionTitle: { fontSize: typography.fontSize.md, fontWeight: '700', color: lightColors.textPrimary, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { flex: 1, marginRight: spacing.md },
  label: { fontSize: typography.fontSize.md, fontWeight: '600', color: lightColors.textPrimary },
  hint: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 2 },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.background,
    marginBottom: spacing.sm,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: lightColors.border,
    marginBottom: spacing.sm,
  },
  typeCardActive: { borderColor: lightColors.primary, backgroundColor: lightColors.primary + '08' },
  typeCardContent: { flex: 1 },
  typeLabel: { fontSize: typography.fontSize.md, fontWeight: '600', color: lightColors.textPrimary },
  typeLabelActive: { color: lightColors.primary },
  typeDesc: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 2 },
  comingSoon: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, fontWeight: '400' },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  testButtonText: { color: lightColors.textOnPrimary, fontWeight: '600', fontSize: typography.fontSize.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.xs },
  statusText: { fontSize: typography.fontSize.sm, fontWeight: '600' },
  statusOk: { color: lightColors.success },
  statusFail: { color: lightColors.error },
  saveButton: {
    backgroundColor: lightColors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: { color: lightColors.textOnPrimary, fontWeight: '700', fontSize: typography.fontSize.md },
});
