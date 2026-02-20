import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { useEcommerceSettings } from '../../hooks/useEcommerceSettings';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import { Button } from '../../components/Button';
import { useTranslate } from '../../hooks/useTranslate';
import { ECommercePlatform } from '../../utils/platforms';

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
  offline: 'Offline',
};

const EcommerceSettingsTab: React.FC = () => {
  const { t } = useTranslate();
  // Use the e-commerce settings hook
  const {
    ecommerceSettings,
    hasUnsavedChanges,
    updateSettings,
    saveChanges,
    cancelChanges,
    testConnection: testEcommerceConnection,
  } = useEcommerceSettings();

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
      updateSettings({ apiKey });
    },
    [updateSettings]
  );

  // Handle store URL change
  const handleStoreUrlChange = useCallback(
    (storeUrl: string) => {
      // Update the store URL in the appropriate platform settings
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
      } else {
        // For other platforms, update the main apiUrl
        updateSettings({ apiUrl: storeUrl });
      }
    },
    [updateSettings, ecommerceSettings.platform, ecommerceSettings.shopify, ecommerceSettings.woocommerce]
  );

  // Handle enabled toggle
  const handleEnabledChange = useCallback(
    (enabled: boolean) => {
      console.log('Toggling enabled to:', enabled);
      updateSettings({ enabled });
    },
    [updateSettings]
  );

  // Handle test connection
  const handleTestConnection = useCallback(async () => {
    await testEcommerceConnection();
  }, [testEcommerceConnection]);

  // Handle save
  const handleSave = useCallback(async () => {
    const success = await saveChanges();
    if (success) {
      Alert.alert(t('common.success'), t('settings.ecommerce.saveSuccess'));
    }
  }, [saveChanges]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    cancelChanges();
  }, [cancelChanges]);

  // Connection test handler
  const handleConnectionTest = useCallback(async () => {
    console.log('Testing ecommerce connection');
    await testEcommerceConnection();
  }, [testEcommerceConnection]);

  return (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>{t('settings.ecommerce.title')}</Text>

      <View style={styles.optionRow}>
        <Text style={styles.label}>{t('settings.ecommerce.enableEcommerce')}</Text>
        <TouchableOpacity
          style={[styles.toggleButton, ecommerceSettings.enabled ? styles.toggleActive : styles.toggleInactive]}
          onPress={() => {
            const newEnabledState = !ecommerceSettings.enabled;
            console.log('Toggle pressed, new state:', newEnabledState);
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
            />
          </View>

          {/* API Key */}
          <View style={styles.optionRow}>
            <Text style={styles.label}>
              {ecommerceSettings.platform === 'shopify' ? t('settings.ecommerce.adminApiToken') : t('settings.payment.apiKey')}
            </Text>
            <TextInput
              style={styles.input}
              value={ecommerceSettings.apiKey}
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

          {ecommerceSettings.platform === 'magento' && (
            <View style={styles.optionRow}>
              <Text style={styles.label}>{t('settings.ecommerce.storeUrl')}</Text>
              <TextInput
                style={styles.input}
                value={ecommerceSettings.magento?.storeUrl || ''}
                onChangeText={value =>
                  updateSettings({
                    magento: { ...ecommerceSettings.magento, storeUrl: value },
                  })
                }
                placeholder={t('settings.ecommerce.magentoUrlPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                editable={ecommerceSettings.enabled}
              />
            </View>
          )}

          {ecommerceSettings.platform === 'sylius' && (
            <View style={styles.optionRow}>
              <Text style={styles.label}>{t('settings.ecommerce.apiUrl')}</Text>
              <TextInput
                style={styles.input}
                value={ecommerceSettings.sylius?.storeUrl || ''}
                onChangeText={value =>
                  updateSettings({
                    sylius: { ...ecommerceSettings.sylius, storeUrl: value },
                  })
                }
                placeholder={t('settings.ecommerce.syliusUrlPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                editable={ecommerceSettings.enabled}
              />
            </View>
          )}

          {ecommerceSettings.platform === 'wix' && (
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
          )}

          {ecommerceSettings.platform === 'prestashop' && (
            <View style={styles.optionRow}>
              <Text style={styles.label}>{t('settings.ecommerce.storeUrl')}</Text>
              <TextInput
                style={styles.input}
                value={ecommerceSettings.prestashop?.storeUrl || ''}
                onChangeText={value =>
                  updateSettings({
                    prestashop: { ...ecommerceSettings.prestashop, storeUrl: value },
                  })
                }
                placeholder={t('settings.ecommerce.prestashopUrlPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                editable={ecommerceSettings.enabled}
              />
            </View>
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
                <Text style={styles.label}>{t('settings.ecommerce.menuUrl')}</Text>
                <TextInput
                  style={styles.input}
                  value={ecommerceSettings.offline?.menuUrl || ''}
                  onChangeText={value =>
                    updateSettings({
                      offline: { ...ecommerceSettings.offline, menuUrl: value },
                    })
                  }
                  placeholder={t('settings.ecommerce.menuUrlPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={ecommerceSettings.enabled}
                  keyboardType="url"
                />
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
              <Button
                title={t('settings.ecommerce.downloadMenu')}
                variant="secondary"
                onPress={async () => {
                  const menuUrl = ecommerceSettings.offline?.menuUrl;
                  if (!menuUrl) {
                    Alert.alert(t('common.error'), t('settings.ecommerce.menuUrlRequired'));
                    return;
                  }
                  try {
                    Alert.alert(t('settings.ecommerce.downloading'), t('settings.ecommerce.downloadingMenu'));
                    const response = await fetch(menuUrl);
                    const data = await response.json();
                    const productCount = data.products?.length || data.items?.length || data.menu?.length || 0;
                    const categoryCount = data.categories?.length || 0;
                    Alert.alert(
                      t('common.success'),
                      t('settings.ecommerce.downloadSuccess', { products: productCount, categories: categoryCount })
                    );
                  } catch (error) {
                    Alert.alert(t('common.error'), t('settings.ecommerce.downloadError'));
                  }
                }}
                disabled={!ecommerceSettings.enabled}
                style={styles.actionButton}
              />
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
              disabled={!ecommerceSettings.enabled}
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
  buttonText: {
    color: lightColors.textOnPrimary,
    fontWeight: typography.fontWeight.semiBold as '600',
    fontSize: typography.fontSize.sm,
  },
  saveButtonDisabled: {
    backgroundColor: lightColors.divider,
    opacity: 0.7,
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
  testButton: {
    backgroundColor: lightColors.info,
  },
  saveButton: {
    backgroundColor: lightColors.success,
  },
  cancelButton: {
    backgroundColor: lightColors.error,
    flex: 1,
    marginRight: spacing.xs,
  },
  infoBox: {
    backgroundColor: '#e7f3ff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: lightColors.primary,
  },
  infoTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold as '600',
    color: '#0056b3',
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    lineHeight: 20,
  },
});

export default EcommerceSettingsTab;
