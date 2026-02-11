export enum ECommercePlatform {
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
  MAGENTO = 'magento',
  BIGCOMMERCE = 'bigcommerce',
  SYLIUS = 'sylius',
  WIX = 'wix',
  PRESTASHOP = 'prestashop',
  SQUARESPACE = 'squarespace',
  OFFLINE = 'offline', // Offline mode - all data managed locally via SQLite
}

/**
 * The default platform when no platform has been configured.
 * Offline ensures the app works out of the box without any online setup.
 */
export const DEFAULT_PLATFORM = ECommercePlatform.OFFLINE;

/**
 * Platforms that require an internet connection and API credentials.
 */
const ONLINE_PLATFORMS: ReadonlySet<ECommercePlatform> = new Set([
  ECommercePlatform.SHOPIFY,
  ECommercePlatform.WOOCOMMERCE,
  ECommercePlatform.MAGENTO,
  ECommercePlatform.BIGCOMMERCE,
  ECommercePlatform.SYLIUS,
  ECommercePlatform.WIX,
  ECommercePlatform.PRESTASHOP,
  ECommercePlatform.SQUARESPACE,
]);

/**
 * Check whether a platform requires an online connection.
 */
export function isOnlinePlatform(platform: ECommercePlatform): boolean {
  return ONLINE_PLATFORMS.has(platform);
}

/**
 * Human-readable display names for each platform.
 */
export const PLATFORM_DISPLAY_NAMES: Readonly<Record<ECommercePlatform, string>> = {
  [ECommercePlatform.SHOPIFY]: 'Shopify',
  [ECommercePlatform.WOOCOMMERCE]: 'WooCommerce',
  [ECommercePlatform.MAGENTO]: 'Magento',
  [ECommercePlatform.BIGCOMMERCE]: 'BigCommerce',
  [ECommercePlatform.SYLIUS]: 'Sylius',
  [ECommercePlatform.WIX]: 'Wix',
  [ECommercePlatform.PRESTASHOP]: 'PrestaShop',
  [ECommercePlatform.SQUARESPACE]: 'Squarespace',
  [ECommercePlatform.OFFLINE]: 'Offline Mode',
};

/**
 * Get the display name for a platform, with a sensible fallback.
 */
export function getPlatformDisplayName(platform: ECommercePlatform | string | null | undefined): string {
  if (!platform) return PLATFORM_DISPLAY_NAMES[DEFAULT_PLATFORM];
  return PLATFORM_DISPLAY_NAMES[platform as ECommercePlatform] ?? platform;
}
