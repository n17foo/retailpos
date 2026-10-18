import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import type { ECommerceSettings } from '../../platform-clients/hooks/useEcommerceSettings';
import { settingsFieldStyles as styles } from './settingsFieldStyles';
import {
  buildApiKeyUpdate,
  buildNestedUpdate,
  buildStoreUrlUpdate,
  resolveApiKey,
  resolveStoreUrl,
} from '../utils/ecommerceSettingsFields';

interface PlatformCredentialFieldsProps {
  settings: ECommerceSettings;
  updateSettings: (updates: Partial<ECommerceSettings>) => void;
}

/**
 * Store URL, API key, and the per-platform extra credential fields
 * (WooCommerce/Commercefull secrets, BigCommerce hash/client id, Wix
 * site/account ids, offline store name). Rendered inside the e-commerce
 * settings tab when e-commerce is enabled.
 */
export const PlatformCredentialFields: React.FC<PlatformCredentialFieldsProps> = ({ settings, updateSettings }) => {
  const { t } = useTranslate();
  const { platform, enabled } = settings;

  return (
    <>
      {platform !== 'offline' && platform !== 'wix' && (
        <>
          {/* Store URL */}
          <View style={styles.optionRow}>
            <Text style={styles.label}>
              {platform === 'shopify'
                ? t('settings.ecommerce.shopifyStoreUrl')
                : platform === 'woocommerce'
                  ? t('settings.ecommerce.woocommerceStoreUrl')
                  : t('settings.ecommerce.storeUrl')}
            </Text>
            <TextInput
              style={styles.input}
              value={resolveStoreUrl(settings)}
              onChangeText={storeUrl => updateSettings(buildStoreUrlUpdate(settings, storeUrl))}
              placeholder={
                platform === 'shopify'
                  ? t('settings.ecommerce.shopifyUrlPlaceholder')
                  : platform === 'woocommerce'
                    ? t('settings.ecommerce.woocommerceUrlPlaceholder')
                    : t('settings.ecommerce.defaultUrlPlaceholder')
              }
              autoCapitalize="none"
              autoCorrect={false}
              editable={enabled}
              keyboardType="url"
            />
          </View>

          {/* API Key */}
          <View style={styles.optionRow}>
            <Text style={styles.label}>
              {platform === 'shopify' ? t('settings.ecommerce.adminApiToken') : t('settings.payment.apiKey')}
            </Text>
            <TextInput
              style={styles.input}
              value={resolveApiKey(settings)}
              onChangeText={apiKey => updateSettings(buildApiKeyUpdate(settings, apiKey))}
              placeholder={
                platform === 'shopify' ? t('settings.ecommerce.shopifyApiPlaceholder') : t('settings.ecommerce.apiKeyPlaceholder')
              }
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={enabled}
            />
          </View>
        </>
      )}

      {platform === 'woocommerce' && (
        <View style={styles.optionRow}>
          <Text style={styles.label}>{t('settings.ecommerce.consumerSecret')}</Text>
          <TextInput
            style={styles.input}
            value={settings.woocommerce?.apiSecret || ''}
            onChangeText={value => updateSettings(buildNestedUpdate(settings, 'woocommerce', { apiSecret: value }))}
            placeholder={t('settings.ecommerce.consumerSecretPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={enabled}
          />
        </View>
      )}

      {platform === 'commercefull' && (
        <View style={styles.optionRow}>
          <Text style={styles.label}>{t('settings.ecommerce.consumerSecret')}</Text>
          <TextInput
            style={styles.input}
            value={settings.commercefull?.apiSecret || ''}
            onChangeText={value => updateSettings(buildNestedUpdate(settings, 'commercefull', { apiSecret: value }))}
            placeholder={t('settings.ecommerce.consumerSecretPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={enabled}
          />
        </View>
      )}

      {platform === 'bigcommerce' && (
        <>
          <View style={styles.optionRow}>
            <Text style={styles.label}>{t('settings.ecommerce.storeHash')}</Text>
            <TextInput
              style={styles.input}
              value={settings.bigcommerce?.storeHash || ''}
              onChangeText={value => updateSettings(buildNestedUpdate(settings, 'bigcommerce', { storeHash: value }))}
              placeholder={t('settings.ecommerce.storeHashPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              editable={enabled}
            />
          </View>
          <View style={styles.optionRow}>
            <Text style={styles.label}>{t('settings.ecommerce.clientId')}</Text>
            <TextInput
              style={styles.input}
              value={settings.bigcommerce?.clientId || ''}
              onChangeText={value => updateSettings(buildNestedUpdate(settings, 'bigcommerce', { clientId: value }))}
              placeholder={t('settings.ecommerce.clientIdPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              editable={enabled}
            />
          </View>
        </>
      )}

      {platform === 'wix' && (
        <>
          <View style={styles.optionRow}>
            <Text style={styles.label}>{t('settings.ecommerce.siteId')}</Text>
            <TextInput
              style={styles.input}
              value={settings.wix?.siteId || ''}
              onChangeText={value => updateSettings(buildNestedUpdate(settings, 'wix', { siteId: value }))}
              placeholder={t('settings.ecommerce.wixSiteIdPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              editable={enabled}
            />
          </View>
          <View style={styles.optionRow}>
            <Text style={styles.label}>{t('settings.ecommerce.clientId')}</Text>
            <TextInput
              style={styles.input}
              value={settings.wix?.accountId || ''}
              onChangeText={value => updateSettings(buildNestedUpdate(settings, 'wix', { accountId: value }))}
              placeholder={t('settings.ecommerce.clientIdPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              editable={enabled}
            />
          </View>
        </>
      )}

      {platform === 'offline' && (
        <>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>{t('settings.ecommerce.localOnlyMode')}</Text>
            <Text style={styles.infoText}>{t('settings.ecommerce.localOnlyDescription')}</Text>
          </View>
          <View style={styles.optionRow}>
            <Text style={styles.label}>{t('settings.ecommerce.storeName')}</Text>
            <TextInput
              style={styles.input}
              value={settings.offline?.storeName || ''}
              onChangeText={value => updateSettings(buildNestedUpdate(settings, 'offline', { storeName: value }))}
              placeholder={t('settings.ecommerce.storeNamePlaceholder')}
              editable={enabled}
            />
          </View>
        </>
      )}
    </>
  );
};
