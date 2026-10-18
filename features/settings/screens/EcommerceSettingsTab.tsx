import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useEcommerceSettings } from '../../platform-clients/hooks/useEcommerceSettings';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { ECommercePlatform } from '../../../shared/utils/platforms';
import { useLogger } from '../../../shared/hooks/useLogger';
import { auditLogService } from '../../../shared/services/audit/AuditLogService';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import { settingsFieldStyles } from '../components/settingsFieldStyles';
import { CapabilitySummaryPanel } from '../components/CapabilitySummaryPanel';
import { PlatformRadioGroup } from '../components/PlatformRadioGroup';
import { PlatformCredentialFields } from '../components/PlatformCredentialFields';

const EcommerceSettingsTab: React.FC = () => {
  const { t } = useTranslate();
  const { user } = useAuthContext();
  // Use the e-commerce settings hook
  const {
    ecommerceSettings,
    hasUnsavedChanges,
    updateSettings,
    saveChanges,
    cancelChanges,
    testConnection: testEcommerceConnection,
  } = useEcommerceSettings();

  const logger = useLogger('EcommerceSettingsTab');

  // Handle platform change
  const handlePlatformChange = useCallback(
    (platform: ECommercePlatform) => {
      updateSettings({ platform });
    },
    [updateSettings]
  );

  // Handle enabled toggle
  const handleEnabledChange = useCallback(
    (enabled: boolean) => {
      logger.info('Toggling enabled to:', enabled);
      updateSettings({ enabled });
    },
    [updateSettings, logger]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    // Persist capability profile identifier (spec: settings-tabs.md §5.10)
    const PlatformCapabilityService =
      require('../../platform-clients/services/platform/PlatformCapabilityService').PlatformCapabilityService;
    const platformCapabilityService = PlatformCapabilityService.getInstance();
    const capabilities = platformCapabilityService.getCapabilities();

    // Generate capability profile ID from platform and basket mode
    const capabilityProfileId = `${ecommerceSettings.platform}_${capabilities.basketMode}_v1`;

    // Update settings with capability profile ID
    updateSettings({ capabilityProfileId });

    const success = await saveChanges();
    if (success) {
      // Update platform capability cache immediately (spec §6.3)
      platformCapabilityService.setPlatform(ecommerceSettings.platform);

      // Log settings change (spec: audit.md §2.1.8)
      await auditLogService.log('settings:changed', {
        userId: user?.id,
        userName: user?.username,
        details: 'E-commerce settings updated',
        metadata: {
          settingName: 'ecommerce',
          platform: ecommerceSettings.platform,
          enabled: ecommerceSettings.enabled,
        },
      });

      Alert.alert(t('common.success'), t('settings.ecommerce.saveSuccess'));
    }
  }, [saveChanges, ecommerceSettings.platform, ecommerceSettings.enabled, updateSettings, user, t]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    cancelChanges();
  }, [cancelChanges]);

  // Connection test handler
  const handleConnectionTest = useCallback(async () => {
    logger.info('Testing ecommerce connection');
    if (ecommerceSettings.platform === 'offline') {
      Alert.alert(t('common.info'), t('settings.ecommerce.localOnlyDescription'));
      return;
    }
    await testEcommerceConnection();
  }, [testEcommerceConnection, logger, ecommerceSettings.platform, t]);

  return (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>{t('settings.ecommerce.title')}</Text>

      <View style={settingsFieldStyles.optionRow}>
        <Text style={settingsFieldStyles.label}>{t('settings.ecommerce.enableEcommerce')}</Text>
        <TouchableOpacity
          style={[
            settingsFieldStyles.toggleButton,
            ecommerceSettings.enabled ? settingsFieldStyles.toggleActive : settingsFieldStyles.toggleInactive,
          ]}
          onPress={() => {
            const newEnabledState = !ecommerceSettings.enabled;
            logger.info('Toggle pressed, new state:', newEnabledState);
            handleEnabledChange(newEnabledState);
          }}
        >
          <Text style={[settingsFieldStyles.toggleText, ecommerceSettings.enabled && settingsFieldStyles.toggleActiveText]}>
            {ecommerceSettings.enabled ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {ecommerceSettings.enabled && (
        <>
          {/* Platform Selection */}
          <View style={settingsFieldStyles.optionRow}>
            <Text style={settingsFieldStyles.label}>{t('settings.ecommerce.platform')}</Text>
            <PlatformRadioGroup selected={ecommerceSettings.platform} onSelect={handlePlatformChange} />
          </View>

          {/* Platform Capability Summary — spec §5.3.a, §5.3.b */}
          {ecommerceSettings.platform && <CapabilitySummaryPanel platform={ecommerceSettings.platform} />}

          {/* Store URL, API key and per-platform credential fields */}
          <PlatformCredentialFields settings={ecommerceSettings} updateSettings={updateSettings} />

          {/* Sync Inventory Toggle */}
          <View style={settingsFieldStyles.optionRow}>
            <Text style={settingsFieldStyles.label}>{t('settings.ecommerce.syncInventory')}</Text>
            <TouchableOpacity
              style={[
                settingsFieldStyles.toggleButton,
                ecommerceSettings.syncInventory ? settingsFieldStyles.toggleActive : settingsFieldStyles.toggleInactive,
                !ecommerceSettings.enabled && settingsFieldStyles.disabled,
              ]}
              onPress={() =>
                ecommerceSettings.enabled &&
                updateSettings({
                  syncInventory: !ecommerceSettings.syncInventory,
                })
              }
              disabled={!ecommerceSettings.enabled}
            >
              <Text style={settingsFieldStyles.toggleText}>{ecommerceSettings.syncInventory ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Button
              title={t('settings.payment.testConnection')}
              variant="secondary"
              onPress={handleConnectionTest}
              disabled={!ecommerceSettings.enabled || ecommerceSettings.platform === 'offline'}
              style={styles.actionButton}
            />

            {hasUnsavedChanges && <Button title={t('common.cancel')} variant="danger" onPress={handleCancel} style={styles.actionButton} />}

            <Button
              title={hasUnsavedChanges ? t('settings.scanner.saveChanges') : t('settings.ecommerce.saved')}
              variant="success"
              onPress={handleSave}
              disabled={!hasUnsavedChanges || !ecommerceSettings.enabled}
              style={styles.actionButton}
            />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  settingsSection: {
    padding: spacing.lg,
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    margin: spacing.sm,
    ...elevation.low,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as '700',
    marginBottom: spacing.lg,
    color: lightColors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.divider,
    paddingBottom: spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.divider,
  },
  actionButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: 120,
    ...elevation.low,
  },
});

export default EcommerceSettingsTab;
