import { ECommercePlatform } from '../../utils/platforms';
import { EcommerceSettingsStorage } from './EcommerceSettingsStorage';
import type { StoredECommerceSettings } from './ServiceConfigBridge';
import { LoggerFactory } from '../logger/LoggerFactory';

const logger = LoggerFactory.getInstance().createLogger('PlatformCredentialsResolver');

/**
 * Per-platform API credentials resolved from the stored e-commerce settings.
 * All fields are optional — presence depends on what the platform requires.
 */
export interface PlatformCredentials {
  apiUrl?: string;
  storeUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  apiVersion?: string;
  clientId?: string;
  storeHash?: string;
  siteId?: string;
  accountId?: string;
  apiToken?: string;
  username?: string;
  password?: string;
  [key: string]: string | undefined;
}

/**
 * Legacy per-platform secret keys. Historically providers and refund services
 * read `<platform>_api_credentials` JSON blobs from the secrets backend.
 * Nothing in the app writes those keys, but external provisioning may — so
 * they are still honoured as an override on top of the stored settings.
 */
const LEGACY_SECRET_KEYS: Partial<Record<ECommercePlatform, string>> = {
  [ECommercePlatform.SHOPIFY]: 'shopify_api_credentials',
  [ECommercePlatform.WOOCOMMERCE]: 'woocommerce_api_credentials',
  [ECommercePlatform.MAGENTO]: 'magento_api_credentials',
  [ECommercePlatform.BIGCOMMERCE]: 'bigcommerce_api_credentials',
  [ECommercePlatform.SYLIUS]: 'sylius_api_credentials',
  [ECommercePlatform.WIX]: 'wix_api_credentials',
  [ECommercePlatform.PRESTASHOP]: 'prestashop_api_credentials',
  [ECommercePlatform.SQUARESPACE]: 'squarespace_api_credentials',
  [ECommercePlatform.COMMERCEFULL]: 'commercefull_api_credentials',
};

/**
 * Resolve the API credentials for a platform.
 *
 * Primary source: the `config:ecommerceSettings` secret written by the
 * settings flow (via `ProtectedValueStore`). Any values present in the
 * legacy `<platform>_api_credentials` secret are merged on top.
 *
 * @returns The credentials, or null when nothing usable is configured.
 */
export async function getPlatformCredentials(platform: ECommercePlatform): Promise<PlatformCredentials | null> {
  let settings: StoredECommerceSettings | null = null;
  try {
    settings = await EcommerceSettingsStorage.load<StoredECommerceSettings>();
  } catch (error) {
    logger.warn({ message: `Failed to load e-commerce settings for ${platform}`, ...(error as Record<string, unknown>) });
  }
  const resolved: PlatformCredentials = settings ? mapSettingsToCredentials(settings, platform) : {};

  const legacyKey = LEGACY_SECRET_KEYS[platform];
  if (legacyKey) {
    const legacy = await readLegacyCredentials(legacyKey);
    if (legacy) {
      for (const [key, value] of Object.entries(legacy)) {
        if (typeof value === 'string' && value) {
          resolved[key] = value;
        }
      }
    }
  }

  return Object.values(resolved).some(value => !!value) ? resolved : null;
}

async function readLegacyCredentials(key: string): Promise<Record<string, unknown> | null> {
  try {
    const { secretsServiceFactory } = require('../secrets/SecretsService');
    const raw = await secretsServiceFactory.getService().getSecret(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function mapSettingsToCredentials(settings: StoredECommerceSettings, platform: ECommercePlatform): PlatformCredentials {
  const storeUrl = (url?: string) => url || settings.apiUrl || undefined;

  switch (platform) {
    case ECommercePlatform.SHOPIFY: {
      const url = storeUrl(settings.shopify?.storeUrl);
      return {
        apiUrl: url,
        storeUrl: url,
        apiKey: settings.shopify?.apiKey || settings.apiKey || undefined,
        accessToken: settings.shopify?.accessToken || settings.apiKey || undefined,
      };
    }
    case ECommercePlatform.WOOCOMMERCE: {
      const url = storeUrl(settings.woocommerce?.storeUrl);
      return {
        apiUrl: url,
        storeUrl: url,
        apiKey: settings.woocommerce?.apiKey || settings.apiKey || undefined,
        apiSecret: settings.woocommerce?.apiSecret || undefined,
      };
    }
    case ECommercePlatform.MAGENTO: {
      const url = storeUrl(settings.magento?.storeUrl);
      return {
        apiUrl: url,
        storeUrl: url,
        accessToken: settings.magento?.accessToken || settings.apiKey || undefined,
        apiVersion: settings.magento?.apiVersion || undefined,
      };
    }
    case ECommercePlatform.BIGCOMMERCE:
      return {
        clientId: settings.bigcommerce?.clientId || undefined,
        accessToken: settings.bigcommerce?.accessToken || settings.apiKey || undefined,
        storeHash: settings.bigcommerce?.storeHash || undefined,
      };
    case ECommercePlatform.SYLIUS: {
      const url = storeUrl(settings.sylius?.storeUrl);
      const token = settings.sylius?.apiToken || settings.apiKey || undefined;
      return { apiUrl: url, storeUrl: url, apiToken: token, accessToken: token, apiVersion: settings.sylius?.apiVersion || undefined };
    }
    case ECommercePlatform.WIX:
      return {
        apiKey: settings.wix?.apiKey || settings.apiKey || undefined,
        siteId: settings.wix?.siteId || undefined,
        accountId: settings.wix?.accountId || undefined,
      };
    case ECommercePlatform.PRESTASHOP: {
      const url = storeUrl(settings.prestashop?.storeUrl);
      return { apiUrl: url, storeUrl: url, apiKey: settings.prestashop?.apiKey || settings.apiKey || undefined };
    }
    case ECommercePlatform.SQUARESPACE:
      return {
        apiKey: settings.squarespace?.apiKey || settings.apiKey || undefined,
        siteId: settings.squarespace?.siteId || undefined,
      };
    case ECommercePlatform.COMMERCEFULL: {
      const url = storeUrl(settings.commercefull?.storeUrl);
      return {
        apiUrl: url,
        storeUrl: url,
        apiKey: settings.commercefull?.apiKey || settings.apiKey || undefined,
        apiSecret: settings.commercefull?.apiSecret || undefined,
      };
    }
    default:
      return {};
  }
}
