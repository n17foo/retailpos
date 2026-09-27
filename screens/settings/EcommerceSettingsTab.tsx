import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { useEcommerceSettings } from '../../hooks/useEcommerceSettings';
import { lightColors, spacing, borderRadius, typography, elevation, semanticColors } from '../../utils/theme';
import { Button } from '../../components/Button';
import { useTranslate } from '../../hooks/useTranslate';
import { ECommercePlatform } from '../../utils/platforms';
import { useLogger } from '../../hooks/useLogger';
import {
  getPlatformCapabilities,
  PlatformCapabilities,
  CapabilityLevel,
  BasketMode,
  getUnavailableReason,
} from '../../utils/platformCapabilities';
import { getPlatformDisplayName } from '../../utils/platforms';
import { auditLogService } from '../../services/audit/AuditLogService';
import { useAuthContext } from '../../contexts/AuthProvider';

// Platform display names
const PLATFORM_NAMES: Record<string, string> = {
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  bigcommerce: 'BigCommerce',
  magento: 'Magento',
  sylius: 'Sylius',
  wix: 'Wix',
  prestashop: 'PrestaShop',
  squarespace: 'Squarespace',
  commercefull: 'Commercefull',
  offline: 'Offline',
};

/** Feature rows shown in the capability summary panel */
const CAPABILITY_FEATURES: Array<{ key: Exclude<keyof PlatformCapabilities, 'basketMode'>; label: string }> = [
  { key: 'catalog', label: 'Catalog & variants' },
  { key: 'customers', label: 'Customer management' },
  { key: 'inventory', label: 'Inventory sync' },
  { key: 'orderSync', label: 'Order sync' },
  { key: 'discounts', label: 'Discounts & coupons' },
  { key: 'giftCards', label: 'Gift cards' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'loyalty', label: 'Loyalty points sync' },
  { key: 'storeCredit', label: 'Store credit sync' },
];

const BASKET_MODE_LABEL: Record<BasketMode, { label: string; description: string; color: string; bg: string }> = {
  native_draft: {
    label: 'Native draft',
    description: 'Platform creates a draft order with server-calculated tax',
    color: '#2e7d32',
    bg: '#e8f5e9',
  },
  remote_cart: {
    label: 'Remote cart',
    description: 'POS basket is local; platform cart/quote created post-payment',
    color: '#e65100',
    bg: '#fff3e0',
  },
  local_only: {
    label: 'Local only',
    description: 'Fully local basket; order imported to platform after payment',
    color: '#1565c0',
    bg: '#e3f2fd',
  },
};

const CAPABILITY_BADGE: Record<CapabilityLevel, { label: string; color: string; bg: string }> = {
  supported: { label: 'Supported', color: '#2e7d32', bg: '#e8f5e9' },
  custom: { label: 'Custom adapter', color: '#e65100', bg: '#fff3e0' },
  not_recommended: { label: 'Not supported', color: '#b71c1c', bg: '#ffebee' },
};

interface CapabilitySummaryPanelProps {
  platform: string;
}

/**
 * Platform Capability Summary panel.
 * Reads from the centralized capability matrix — no hardcoded values.
 * Satisfies settings-tabs.md §5.3.a, §5.3.b, §5.11.
 */
const CapabilitySummaryPanel: React.FC<CapabilitySummaryPanelProps> = ({ platform }) => {
  const capabilities = useMemo(() => getPlatformCapabilities(platform), [platform]);
  const platformName = getPlatformDisplayName(platform);
  const basketModeInfo = BASKET_MODE_LABEL[capabilities.basketMode];

  return (
    <View style={capStyles.container}>
      <Text style={capStyles.title}>Platform capability summary</Text>
      <Text style={capStyles.subtitle}>{platformName}</Text>

      {/* Basket mode — shown first as it affects checkout behaviour */}
      <View style={capStyles.row}>
        <Text style={capStyles.featureLabel}>Basket / checkout mode</Text>
        <View style={[capStyles.badge, { backgroundColor: basketModeInfo.bg }]}>
          <Text style={[capStyles.badgeText, { color: basketModeInfo.color }]}>{basketModeInfo.label}</Text>
        </View>
        <Text style={capStyles.reason} numberOfLines={2}>
          {basketModeInfo.description}
        </Text>
      </View>

      {CAPABILITY_FEATURES.map(({ key, label }) => {
        const level = capabilities[key];
        const badge = CAPABILITY_BADGE[level];
        const reason = level !== 'supported' ? getUnavailableReason(capabilities, key, platformName) : '';
        return (
          <View key={key} style={capStyles.row}>
            <Text style={capStyles.featureLabel}>{label}</Text>
            <View style={[capStyles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[capStyles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
            {reason ? (
              <Text style={capStyles.reason} numberOfLines={2}>
                {reason}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const capStyles = StyleSheet.create({
  container: {
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold as '600',
    color: lightColors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    flexWrap: 'wrap' as const,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.divider,
  },
  featureLabel: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: lightColors.textPrimary,
    paddingRight: spacing.xs,
    paddingTop: 2,
  },
  badge: {
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    alignSelf: 'flex-start' as const,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  reason: {
    width: '100%',
    fontSize: 10,
    color: lightColors.textSecondary,
    marginTop: 2,
    fontStyle: 'italic' as const,
  },
});

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

  // Handle API key change
  const handleApiKeyChange = useCallback(
    (apiKey: string) => {
      if (ecommerceSettings.platform === 'shopify') {
        updateSettings({
          apiKey,
          shopify: {
            ...ecommerceSettings.shopify,
            apiKey,
            accessToken: apiKey,
          },
        });
      } else if (ecommerceSettings.platform === 'woocommerce') {
        updateSettings({
          apiKey,
          woocommerce: {
            ...ecommerceSettings.woocommerce,
            apiKey,
          },
        });
      } else if (ecommerceSettings.platform === 'bigcommerce') {
        updateSettings({
          apiKey,
          bigcommerce: {
            ...ecommerceSettings.bigcommerce,
            accessToken: apiKey,
          },
        });
      } else if (ecommerceSettings.platform === 'magento') {
        updateSettings({
          apiKey,
          magento: {
            ...ecommerceSettings.magento,
            accessToken: apiKey,
          },
        });
      } else if (ecommerceSettings.platform === 'sylius') {
        updateSettings({
          apiKey,
          sylius: {
            ...ecommerceSettings.sylius,
            apiToken: apiKey,
          },
        });
      } else if (ecommerceSettings.platform === 'wix') {
        updateSettings({
          apiKey,
          wix: {
            ...ecommerceSettings.wix,
            apiKey,
          },
        });
      } else if (ecommerceSettings.platform === 'prestashop') {
        updateSettings({
          apiKey,
          prestashop: {
            ...ecommerceSettings.prestashop,
            apiKey,
          },
        });
      } else if (ecommerceSettings.platform === 'squarespace') {
        updateSettings({
          apiKey,
          squarespace: {
            ...ecommerceSettings.squarespace,
            apiKey,
          },
        });
      } else if (ecommerceSettings.platform === 'commercefull') {
        updateSettings({
          apiKey,
          commercefull: {
            ...ecommerceSettings.commercefull,
            apiKey,
          },
        });
      } else {
        updateSettings({ apiKey });
      }
    },
    [updateSettings, ecommerceSettings]
  );

  // Handle store URL change
  const handleStoreUrlChange = useCallback(
    (storeUrl: string) => {
      if (ecommerceSettings.platform === 'shopify') {
        updateSettings({
          shopify: {
            ...ecommerceSettings.shopify,
            storeUrl: storeUrl,
          },
        });
      } else if (ecommerceSettings.platform === 'woocommerce') {
        updateSettings({
          woocommerce: {
            ...ecommerceSettings.woocommerce,
            storeUrl: storeUrl,
          },
        });
      } else if (ecommerceSettings.platform === 'magento') {
        updateSettings({
          magento: {
            ...ecommerceSettings.magento,
            storeUrl,
          },
        });
      } else if (ecommerceSettings.platform === 'sylius') {
        updateSettings({
          sylius: {
            ...ecommerceSettings.sylius,
            storeUrl,
          },
        });
      } else if (ecommerceSettings.platform === 'prestashop') {
        updateSettings({
          prestashop: {
            ...ecommerceSettings.prestashop,
            storeUrl,
          },
        });
      } else if (ecommerceSettings.platform === 'commercefull') {
        updateSettings({
          commercefull: {
            ...ecommerceSettings.commercefull,
            storeUrl,
          },
        });
      } else {
        updateSettings({ apiUrl: storeUrl });
      }
    },
    [
      updateSettings,
      ecommerceSettings.platform,
      ecommerceSettings.shopify,
      ecommerceSettings.woocommerce,
      ecommerceSettings.magento,
      ecommerceSettings.sylius,
      ecommerceSettings.prestashop,
      ecommerceSettings.commercefull,
    ]
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
    const PlatformCapabilityService = require('../../services/platform/PlatformCapabilityService').PlatformCapabilityService;
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

      <View style={styles.optionRow}>
        <Text style={styles.label}>{t('settings.ecommerce.enableEcommerce')}</Text>
        <TouchableOpacity
          style={[styles.toggleButton, ecommerceSettings.enabled ? styles.toggleActive : styles.toggleInactive]}
          onPress={() => {
            const newEnabledState = !ecommerceSettings.enabled;
            logger.info('Toggle pressed, new state:', newEnabledState);
            handleEnabledChange(newEnabledState);
          }}
        >
          <Text style={[styles.toggleText, ecommerceSettings.enabled && styles.toggleActiveText]}>
            {ecommerceSettings.enabled ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {ecommerceSettings.enabled && (
        <>
          {/* Platform Selection */}
          <View style={styles.optionRow}>
            <Text style={styles.label}>{t('settings.ecommerce.platform')}</Text>
            <View style={styles.radioContainer}>
              {Object.keys(PLATFORM_NAMES).map(platform => (
                <View key={platform} style={styles.radioWrapper}>
                  <TouchableOpacity style={styles.radioOuter} onPress={() => handlePlatformChange(platform as ECommercePlatform)}>
                    {ecommerceSettings.platform === platform && <View style={styles.radioInner} />}
                  </TouchableOpacity>
                  <Text style={styles.radioLabel} onPress={() => handlePlatformChange(platform as ECommercePlatform)}>
                    {PLATFORM_NAMES[platform]}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Platform Capability Summary — spec §5.3.a, §5.3.b */}
          {ecommerceSettings.platform && <CapabilitySummaryPanel platform={ecommerceSettings.platform} />}

          {ecommerceSettings.platform !== 'offline' &&
            ecommerceSettings.platform !== 'wix' &&
            ecommerceSettings.platform !== 'squarespace' && (
              <>
                {/* Store URL */}
                <View style={styles.optionRow}>
                  <Text style={styles.label}>
                    {ecommerceSettings.platform === 'shopify'
                      ? t('settings.ecommerce.shopifyStoreUrl')
                      : ecommerceSettings.platform === 'woocommerce'
                        ? t('settings.ecommerce.woocommerceStoreUrl')
                        : t('settings.ecommerce.storeUrl')}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={
                      ecommerceSettings.platform === 'shopify'
                        ? ecommerceSettings.shopify?.storeUrl
                        : ecommerceSettings.platform === 'woocommerce'
                          ? ecommerceSettings.woocommerce?.storeUrl
                          : ecommerceSettings.platform === 'magento'
                            ? ecommerceSettings.magento?.storeUrl
                            : ecommerceSettings.platform === 'sylius'
                              ? ecommerceSettings.sylius?.storeUrl
                              : ecommerceSettings.platform === 'prestashop'
                                ? ecommerceSettings.prestashop?.storeUrl
                                : ecommerceSettings.platform === 'commercefull'
                                  ? ecommerceSettings.commercefull?.storeUrl
                                  : ecommerceSettings.apiUrl || ''
                    }
                    onChangeText={handleStoreUrlChange}
                    placeholder={
                      ecommerceSettings.platform === 'shopify'
                        ? t('settings.ecommerce.shopifyUrlPlaceholder')
                        : ecommerceSettings.platform === 'woocommerce'
                          ? t('settings.ecommerce.woocommerceUrlPlaceholder')
                          : t('settings.ecommerce.defaultUrlPlaceholder')
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={ecommerceSettings.enabled}
                    keyboardType="url"
                  />
                </View>

                {/* API Key */}
                <View style={styles.optionRow}>
                  <Text style={styles.label}>
                    {ecommerceSettings.platform === 'shopify' ? t('settings.ecommerce.adminApiToken') : t('settings.payment.apiKey')}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={
                      ecommerceSettings.platform === 'shopify'
                        ? ecommerceSettings.shopify?.accessToken || ecommerceSettings.shopify?.apiKey || ecommerceSettings.apiKey
                        : ecommerceSettings.platform === 'woocommerce'
                          ? ecommerceSettings.woocommerce?.apiKey || ecommerceSettings.apiKey
                          : ecommerceSettings.platform === 'bigcommerce'
                            ? ecommerceSettings.bigcommerce?.accessToken || ecommerceSettings.apiKey
                            : ecommerceSettings.platform === 'magento'
                              ? ecommerceSettings.magento?.accessToken || ecommerceSettings.apiKey
                              : ecommerceSettings.platform === 'sylius'
                                ? ecommerceSettings.sylius?.apiToken || ecommerceSettings.apiKey
                                : ecommerceSettings.platform === 'wix'
                                  ? ecommerceSettings.wix?.apiKey || ecommerceSettings.apiKey
                                  : ecommerceSettings.platform === 'prestashop'
                                    ? ecommerceSettings.prestashop?.apiKey || ecommerceSettings.apiKey
                                    : ecommerceSettings.platform === 'squarespace'
                                      ? ecommerceSettings.squarespace?.apiKey || ecommerceSettings.apiKey
                                      : ecommerceSettings.platform === 'commercefull'
                                        ? ecommerceSettings.commercefull?.apiKey || ecommerceSettings.apiKey
                                        : ecommerceSettings.apiKey
                    }
                    onChangeText={handleApiKeyChange}
                    placeholder={
                      ecommerceSettings.platform === 'shopify'
                        ? t('settings.ecommerce.shopifyApiPlaceholder')
                        : t('settings.ecommerce.apiKeyPlaceholder')
                    }
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={ecommerceSettings.enabled}
                  />
                </View>
              </>
            )}

          {/* Platform-specific settings */}
          {ecommerceSettings.platform === 'woocommerce' && (
            <View style={styles.optionRow}>
              <Text style={styles.label}>{t('settings.ecommerce.consumerSecret')}</Text>
              <TextInput
                style={styles.input}
                value={ecommerceSettings.woocommerce?.apiSecret || ''}
                onChangeText={value =>
                  updateSettings({
                    woocommerce: {
                      ...ecommerceSettings.woocommerce,
                      apiSecret: value,
                    },
                  })
                }
                placeholder={t('settings.ecommerce.consumerSecretPlaceholder')}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={ecommerceSettings.enabled}
              />
            </View>
          )}

          {ecommerceSettings.platform === 'commercefull' && (
            <View style={styles.optionRow}>
              <Text style={styles.label}>{t('settings.ecommerce.consumerSecret')}</Text>
              <TextInput
                style={styles.input}
                value={ecommerceSettings.commercefull?.apiSecret || ''}
                onChangeText={value =>
                  updateSettings({
                    commercefull: { ...ecommerceSettings.commercefull, apiSecret: value },
                  })
                }
                placeholder={t('settings.ecommerce.consumerSecretPlaceholder')}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={ecommerceSettings.enabled}
              />
            </View>
          )}

          {ecommerceSettings.platform === 'bigcommerce' && (
            <>
              <View style={styles.optionRow}>
                <Text style={styles.label}>{t('settings.ecommerce.storeHash')}</Text>
                <TextInput
                  style={styles.input}
                  value={ecommerceSettings.bigcommerce?.storeHash || ''}
                  onChangeText={value =>
                    updateSettings({
                      bigcommerce: { ...ecommerceSettings.bigcommerce, storeHash: value },
                    })
                  }
                  placeholder={t('settings.ecommerce.storeHashPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={ecommerceSettings.enabled}
                />
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.label}>{t('settings.ecommerce.clientId')}</Text>
                <TextInput
                  style={styles.input}
                  value={ecommerceSettings.bigcommerce?.clientId || ''}
                  onChangeText={value =>
                    updateSettings({
                      bigcommerce: { ...ecommerceSettings.bigcommerce, clientId: value },
                    })
                  }
                  placeholder={t('settings.ecommerce.clientIdPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={ecommerceSettings.enabled}
                />
              </View>
            </>
          )}

          {ecommerceSettings.platform === 'wix' && (
            <>
              <View style={styles.optionRow}>
                <Text style={styles.label}>{t('settings.ecommerce.siteId')}</Text>
                <TextInput
                  style={styles.input}
                  value={ecommerceSettings.wix?.siteId || ''}
                  onChangeText={value =>
                    updateSettings({
                      wix: { ...ecommerceSettings.wix, siteId: value },
                    })
                  }
                  placeholder={t('settings.ecommerce.wixSiteIdPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={ecommerceSettings.enabled}
                />
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.label}>{t('settings.ecommerce.clientId')}</Text>
                <TextInput
                  style={styles.input}
                  value={ecommerceSettings.wix?.accountId || ''}
                  onChangeText={value =>
                    updateSettings({
                      wix: { ...ecommerceSettings.wix, accountId: value },
                    })
                  }
                  placeholder={t('settings.ecommerce.clientIdPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={ecommerceSettings.enabled}
                />
              </View>
            </>
          )}

          {ecommerceSettings.platform === 'squarespace' && (
            <View style={styles.optionRow}>
              <Text style={styles.label}>{t('settings.ecommerce.squarespaceSiteIdLabel')}</Text>
              <TextInput
                style={styles.input}
                value={ecommerceSettings.squarespace?.siteId || ''}
                onChangeText={value =>
                  updateSettings({
                    squarespace: { ...ecommerceSettings.squarespace, siteId: value },
                  })
                }
                placeholder={t('settings.ecommerce.squarespaceSiteIdPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                editable={ecommerceSettings.enabled}
              />
            </View>
          )}

          {ecommerceSettings.platform === 'offline' && (
            <>
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>{t('settings.ecommerce.localOnlyMode')}</Text>
                <Text style={styles.infoText}>{t('settings.ecommerce.localOnlyDescription')}</Text>
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.label}>{t('settings.ecommerce.storeName')}</Text>
                <TextInput
                  style={styles.input}
                  value={ecommerceSettings.offline?.storeName || ''}
                  onChangeText={value =>
                    updateSettings({
                      offline: { ...ecommerceSettings.offline, storeName: value },
                    })
                  }
                  placeholder={t('settings.ecommerce.storeNamePlaceholder')}
                  editable={ecommerceSettings.enabled}
                />
              </View>
            </>
          )}

          {/* Sync Inventory Toggle */}
          <View style={styles.optionRow}>
            <Text style={styles.label}>{t('settings.ecommerce.syncInventory')}</Text>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                ecommerceSettings.syncInventory ? styles.toggleActive : styles.toggleInactive,
                !ecommerceSettings.enabled && styles.disabled,
              ]}
              onPress={() =>
                ecommerceSettings.enabled &&
                updateSettings({
                  syncInventory: !ecommerceSettings.syncInventory,
                })
              }
              disabled={!ecommerceSettings.enabled}
            >
              <Text style={styles.toggleText}>{ecommerceSettings.syncInventory ? 'ON' : 'OFF'}</Text>
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

export default EcommerceSettingsTab;
