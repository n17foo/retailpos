import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../utils/theme';
import { localApiConfig, LocalApiMode } from '../../services/localapi/LocalApiConfig';
import { localApiClient } from '../../services/localapi/LocalApiClient';
import { localApiServer } from '../../services/localapi/LocalApiServer';
import { localApiDiscovery, DiscoveredServer } from '../../services/localapi/LocalApiDiscovery';
import { generateUUID } from '../../utils/uuid';
import { useTranslate } from '../../hooks/useTranslate';

const MODE_OPTION_KEYS: { value: LocalApiMode; labelKey: string; descKey: string }[] = [
  { value: 'standalone', labelKey: 'settings.localApi.standalone', descKey: 'settings.localApi.standaloneDesc' },
  { value: 'server', labelKey: 'settings.localApi.server', descKey: 'settings.localApi.serverDesc' },
  { value: 'client', labelKey: 'settings.localApi.client', descKey: 'settings.localApi.clientDesc' },
];

const LocalApiSettingsTab: React.FC = () => {
  const { t } = useTranslate();
  const [mode, setMode] = useState<LocalApiMode>('standalone');
  const [port, setPort] = useState('8787');
  const [sharedSecret, setSharedSecret] = useState('');
  const [registerName, setRegisterName] = useState('Register 1');
  const [serverAddress, setServerAddress] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [scanning, setScanning] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    (async () => {
      const settings = await localApiConfig.load();
      setMode(settings.mode);
      setPort(String(settings.port));
      setSharedSecret(settings.sharedSecret);
      setRegisterName(settings.registerName);
      setServerAddress(settings.serverAddress);
    })();
  }, []);

  const handleSave = useCallback(async () => {
    const registerId = localApiConfig.current.registerId || generateUUID();
    await localApiConfig.save({
      mode,
      port: parseInt(port, 10) || 8787,
      sharedSecret,
      registerName,
      serverAddress,
      registerId,
    });

    if (mode === 'server') {
      localApiServer.start();
      Alert.alert(t('common.saved'), t('settings.localApi.savedServer', { port }));
    } else if (mode === 'client') {
      localApiServer.stop();
      Alert.alert(t('common.saved'), t('settings.localApi.savedClient'));
    } else {
      localApiServer.stop();
      Alert.alert(t('common.saved'), t('settings.localApi.savedStandalone'));
    }
  }, [mode, port, sharedSecret, registerName, serverAddress]);

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus('testing');
    const result = await localApiClient.testConnection();
    setConnectionStatus(result.ok ? 'connected' : 'failed');
    if (!result.ok) {
      Alert.alert(t('settings.localApi.connectionFailed'), result.error || t('settings.localApi.connectionFailedMessage'));
    }
  }, []);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanProgress(0);
    setDiscoveredServers([]);

    const servers = await localApiDiscovery.scanSubnet(undefined, (checked, total) => {
      setScanProgress(Math.round((checked / total) * 100));
    });

    setDiscoveredServers(servers);
    setScanning(false);

    if (servers.length === 0) {
      Alert.alert(t('settings.localApi.noServersFound'), t('settings.localApi.noServersFoundMessage'));
    }
  }, []);

  const handleSelectServer = useCallback(async (server: DiscoveredServer) => {
    setServerAddress(server.address);
    setPort(String(server.port));
    await localApiConfig.save({
      mode: 'client',
      serverAddress: server.address,
      port: server.port,
    });
    setMode('client');
    setConnectionStatus('testing');
    const ok = await localApiDiscovery.connectToServer(server);
    setConnectionStatus(ok ? 'connected' : 'failed');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settings.localApi.title')}</Text>
      <Text style={styles.subtitle}>{t('settings.localApi.description')}</Text>

      {/* Mode selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.localApi.mode')}</Text>
        <View style={styles.modeRow}>
          {MODE_OPTION_KEYS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.modeCard, mode === opt.value && styles.modeCardActive]}
              onPress={() => setMode(opt.value)}
            >
              <MaterialIcons
                name={opt.value === 'standalone' ? 'devices' : opt.value === 'server' ? 'dns' : 'wifi'}
                size={24}
                color={mode === opt.value ? lightColors.primary : lightColors.textSecondary}
              />
              <Text style={[styles.modeLabel, mode === opt.value && styles.modeLabelActive]}>{t(opt.labelKey)}</Text>
              <Text style={styles.modeDesc}>{t(opt.descKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Common fields */}
      {mode !== 'standalone' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.localApi.configuration')}</Text>

          <Text style={styles.fieldLabel}>{t('settings.localApi.registerName')}</Text>
          <TextInput
            style={styles.input}
            value={registerName}
            onChangeText={setRegisterName}
            placeholder={t('settings.localApi.registerNamePlaceholder')}
            placeholderTextColor={lightColors.textSecondary}
          />

          <Text style={styles.fieldLabel}>{t('settings.localApi.port')}</Text>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            keyboardType="number-pad"
            placeholder="8787"
            placeholderTextColor={lightColors.textSecondary}
          />

          <Text style={styles.fieldLabel}>{t('settings.localApi.sharedSecret')}</Text>
          <TextInput
            style={styles.input}
            value={sharedSecret}
            onChangeText={setSharedSecret}
            placeholder={t('settings.localApi.sharedSecretPlaceholder')}
            placeholderTextColor={lightColors.textSecondary}
            secureTextEntry
          />
        </View>
      )}

      {/* Client-specific: server address + discovery */}
      {mode === 'client' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.localApi.serverConnection')}</Text>

          <Text style={styles.fieldLabel}>{t('settings.localApi.serverAddress')}</Text>
          <TextInput
            style={styles.input}
            value={serverAddress}
            onChangeText={setServerAddress}
            placeholder={t('settings.localApi.serverAddressPlaceholder')}
            placeholderTextColor={lightColors.textSecondary}
            keyboardType="numbers-and-punctuation"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleTestConnection} disabled={connectionStatus === 'testing'}>
              {connectionStatus === 'testing' ? (
                <ActivityIndicator size="small" color={lightColors.textOnPrimary} />
              ) : (
                <>
                  <MaterialIcons name="wifi-tethering" size={16} color={lightColors.textOnPrimary} />
                  <Text style={styles.primaryButtonText}>{t('settings.payment.testConnection')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleScan} disabled={scanning}>
              {scanning ? (
                <>
                  <ActivityIndicator size="small" color={lightColors.primary} />
                  <Text style={styles.secondaryButtonText}>{scanProgress}%</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="search" size={16} color={lightColors.primary} />
                  <Text style={styles.secondaryButtonText}>{t('settings.localApi.scanNetwork')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {connectionStatus === 'connected' && (
            <View style={styles.statusBox}>
              <MaterialIcons name="check-circle" size={16} color={lightColors.success} />
              <Text style={[styles.statusText, { color: lightColors.success }]}>{t('settings.localApi.connectedToServer')}</Text>
            </View>
          )}
          {connectionStatus === 'failed' && (
            <View style={styles.statusBox}>
              <MaterialIcons name="error" size={16} color={lightColors.error} />
              <Text style={[styles.statusText, { color: lightColors.error }]}>{t('settings.localApi.connectionFailed')}</Text>
            </View>
          )}

          {/* Discovered servers */}
          {discoveredServers.length > 0 && (
            <View style={styles.discoveredList}>
              <Text style={styles.fieldLabel}>{t('settings.localApi.discoveredServers')}</Text>
              {discoveredServers.map((server, i) => (
                <TouchableOpacity key={i} style={styles.discoveredItem} onPress={() => handleSelectServer(server)}>
                  <MaterialIcons name="dns" size={20} color={lightColors.primary} />
                  <View style={styles.discoveredInfo}>
                    <Text style={styles.discoveredName}>{server.registerName}</Text>
                    <Text style={styles.discoveredAddress}>
                      {server.address}:{server.port}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={lightColors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Save button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>{t('settings.localApi.saveConfig')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: spacing.lg,
  },
  section: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: lightColors.border,
  },
  modeCardActive: {
    borderColor: lightColors.primary,
    backgroundColor: lightColors.primary + '08',
  },
  modeLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginTop: spacing.xs,
  },
  modeLabelActive: {
    color: lightColors.primary,
  },
  modeDesc: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
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
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  primaryButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
    fontSize: typography.fontSize.sm,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: lightColors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  secondaryButtonText: {
    color: lightColors.primary,
    fontWeight: '600',
    fontSize: typography.fontSize.sm,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  discoveredList: {
    marginTop: spacing.md,
  },
  discoveredItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: lightColors.background,
    marginTop: spacing.xs,
  },
  discoveredInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  discoveredName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  discoveredAddress: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  saveButton: {
    backgroundColor: lightColors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '700',
    fontSize: typography.fontSize.md,
  },
});

export default LocalApiSettingsTab;
