import type { ECommerceSettings } from '../../platform-clients/hooks/useEcommerceSettings';

/**
 * Pure field-mapping helpers for the e-commerce settings tab.
 *
 * `ECommerceSettings` keeps a nested credentials object per platform plus
 * legacy flat `apiUrl`/`apiKey`. These helpers resolve which field a UI input
 * reads/writes so the screen doesn't carry per-platform if/else chains.
 */

type PlatformKey = 'shopify' | 'woocommerce' | 'magento' | 'bigcommerce' | 'sylius' | 'wix' | 'prestashop' | 'commercefull';

/** Nested key that stores the platform's API credential. */
const API_KEY_FIELD: Record<PlatformKey, string> = {
  shopify: 'accessToken',
  woocommerce: 'apiKey',
  magento: 'accessToken',
  bigcommerce: 'accessToken',
  sylius: 'apiToken',
  wix: 'apiKey',
  prestashop: 'apiKey',
  commercefull: 'apiKey',
};

/** Platforms whose nested object carries `storeUrl`. */
const STORE_URL_PLATFORMS = new Set<PlatformKey>(['shopify', 'woocommerce', 'magento', 'sylius', 'prestashop', 'commercefull']);

function isPlatformKey(platform: string): platform is PlatformKey {
  return platform in API_KEY_FIELD;
}

/** Current value shown in the Store URL input. */
export function resolveStoreUrl(settings: ECommerceSettings): string {
  const platform = settings.platform;
  if (isPlatformKey(platform) && STORE_URL_PLATFORMS.has(platform)) {
    const nested = settings[platform] as Record<string, string | undefined>;
    return nested?.storeUrl ?? '';
  }
  return settings.apiUrl || '';
}

/** Current value shown in the API key input. */
export function resolveApiKey(settings: ECommerceSettings): string {
  const platform = settings.platform;
  if (isPlatformKey(platform)) {
    const nested = settings[platform] as Record<string, string | undefined>;
    return nested?.[API_KEY_FIELD[platform]] || nested?.apiKey || settings.apiKey;
  }
  return settings.apiKey;
}

/** Build the `updateSettings` payload for an API-key edit. */
export function buildApiKeyUpdate(settings: ECommerceSettings, apiKey: string): Partial<ECommerceSettings> {
  const platform = settings.platform;
  if (!isPlatformKey(platform)) {
    return { apiKey };
  }
  const patch: Record<string, string> = { [API_KEY_FIELD[platform]]: apiKey };
  if (platform === 'shopify') {
    // Shopify stores both fields in sync
    patch.apiKey = apiKey;
  }
  return {
    apiKey,
    [platform]: { ...settings[platform], ...patch },
  } as Partial<ECommerceSettings>;
}

/** Build the `updateSettings` payload for a store-URL edit. */
export function buildStoreUrlUpdate(settings: ECommerceSettings, storeUrl: string): Partial<ECommerceSettings> {
  const platform = settings.platform;
  if (isPlatformKey(platform) && STORE_URL_PLATFORMS.has(platform)) {
    return {
      [platform]: { ...settings[platform], storeUrl },
    } as Partial<ECommerceSettings>;
  }
  return { apiUrl: storeUrl };
}

/** Build the `updateSettings` payload for a field inside a platform's nested object. */
export function buildNestedUpdate<K extends PlatformKey | 'offline'>(
  settings: ECommerceSettings,
  platform: K,
  patch: Partial<ECommerceSettings[K]>
): Partial<ECommerceSettings> {
  return {
    [platform]: { ...settings[platform], ...patch },
  } as Partial<ECommerceSettings>;
}
