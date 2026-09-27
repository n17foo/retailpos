/**
 * Platform Capability Matrix
 *
 * Single source of truth for what each e-commerce platform supports.
 * Used by navigation composers, service guards, and UI gating.
 *
 * Legend:
 *   supported        – first-class, stable API support
 *   custom           – custom adapter required; project/tenant-specific risk
 *   not_recommended  – not recommended for parity promise in current public API shape
 */

import { ECommercePlatform } from './platforms';

export type CapabilityLevel = 'supported' | 'custom' | 'not_recommended';

/**
 * Basket mode determines how the POS interacts with the platform during checkout.
 *
 *   native_draft   — platform has a mutable pre-order object (Draft Orders).
 *                    POS sends items to platform at checkout start; platform
 *                    returns authoritative tax/totals; draft is completed after payment.
 *                    Platforms: Shopify, Wix
 *
 *   remote_cart    — platform has a cart/quote/in-progress order that can hold
 *                    items before payment. POS creates a remote cart, adds items,
 *                    and submits it as an order after payment.
 *                    Platforms: Magento (quote), BigCommerce (Management Cart),
 *                               Sylius (in-progress order), PrestaShop (Cart),
 *                               WooCommerce (pending order)
 *
 *   local_only     — platform has no reliable pre-payment state. POS basket is
 *                    fully local; order is created/imported on the platform after
 *                    payment succeeds.
 *                    Platforms: Squarespace, Offline
 */
export type BasketMode = 'native_draft' | 'remote_cart' | 'local_only';

export interface PlatformCapabilities {
  catalog: CapabilityLevel;
  customers: CapabilityLevel;
  inventory: CapabilityLevel;
  orderSync: CapabilityLevel;
  /** How the POS manages basket state relative to the platform */
  basketMode: BasketMode;
  discounts: CapabilityLevel;
  giftCards: CapabilityLevel;
  refunds: CapabilityLevel;
  /**
   * Outbound loyalty points sync to the platform.
   * The local loyalty ledger (SQLite) is always available regardless of this value.
   * 'supported' = first-class platform loyalty API (future)
   * 'custom'    = custom adapter required (e.g. Shopify loyalty app)
   * 'not_recommended' = local-only; no platform sync
   */
  loyalty: CapabilityLevel;
  /**
   * Outbound store credit sync to the platform.
   * The local store credit ledger (SQLite) is always available regardless of this value.
   * 'supported' = first-class platform store credit API (future)
   * 'custom'    = custom adapter required (e.g. Shopify gift card as store credit)
   * 'not_recommended' = local-only; no platform sync
   */
  storeCredit: CapabilityLevel;
}

/**
 * Authoritative capability matrix per platform.
 * Matches the matrix in docs/specs/platform-capability-rollout.md §3.
 */
export const PLATFORM_CAPABILITY_MATRIX: Readonly<Record<ECommercePlatform, PlatformCapabilities>> = {
  [ECommercePlatform.SHOPIFY]: {
    catalog: 'supported',
    customers: 'supported',
    inventory: 'supported',
    orderSync: 'supported',
    basketMode: 'native_draft',
    discounts: 'supported',
    giftCards: 'supported',
    refunds: 'supported',
    loyalty: 'custom', // Shopify has loyalty apps (e.g. Smile.io) — custom adapter
    storeCredit: 'custom', // Shopify gift cards can act as store credit — custom adapter
  },
  [ECommercePlatform.WOOCOMMERCE]: {
    catalog: 'supported',
    customers: 'supported',
    inventory: 'supported',
    orderSync: 'supported',
    basketMode: 'remote_cart', // pending order acts as remote cart
    discounts: 'supported',
    giftCards: 'custom',
    refunds: 'custom',
    loyalty: 'not_recommended', // no native loyalty API
    storeCredit: 'not_recommended', // no native store credit API
  },
  [ECommercePlatform.MAGENTO]: {
    catalog: 'supported',
    customers: 'supported',
    inventory: 'supported',
    orderSync: 'supported',
    basketMode: 'remote_cart', // Magento quote → submit → order
    discounts: 'supported',
    giftCards: 'custom',
    refunds: 'supported',
    loyalty: 'not_recommended', // no native loyalty API
    storeCredit: 'not_recommended', // no native store credit API
  },
  [ECommercePlatform.BIGCOMMERCE]: {
    catalog: 'supported',
    customers: 'supported',
    inventory: 'supported',
    orderSync: 'supported',
    basketMode: 'remote_cart', // Management Cart/Checkout API
    discounts: 'supported',
    giftCards: 'custom',
    refunds: 'supported',
    loyalty: 'not_recommended', // no native loyalty API
    storeCredit: 'not_recommended', // no native store credit API
  },
  [ECommercePlatform.SYLIUS]: {
    catalog: 'custom',
    customers: 'custom',
    inventory: 'custom',
    orderSync: 'custom',
    basketMode: 'remote_cart', // in-progress order (cart) → complete
    discounts: 'custom',
    giftCards: 'not_recommended',
    refunds: 'custom',
    loyalty: 'not_recommended', // no native loyalty API
    storeCredit: 'not_recommended', // no native store credit API
  },
  [ECommercePlatform.WIX]: {
    catalog: 'supported',
    customers: 'supported',
    inventory: 'supported',
    orderSync: 'supported',
    basketMode: 'native_draft', // Wix Draft Orders API
    discounts: 'supported',
    giftCards: 'supported',
    refunds: 'supported',
    loyalty: 'not_recommended', // Wix loyalty is a separate app, no POS API
    storeCredit: 'not_recommended', // no native store credit API
  },
  [ECommercePlatform.PRESTASHOP]: {
    catalog: 'supported',
    customers: 'supported',
    inventory: 'supported',
    orderSync: 'supported',
    basketMode: 'remote_cart', // PrestaShop Cart → Order
    discounts: 'supported',
    giftCards: 'not_recommended',
    refunds: 'custom',
    loyalty: 'not_recommended', // no native loyalty API
    storeCredit: 'not_recommended', // no native store credit API
  },
  [ECommercePlatform.SQUARESPACE]: {
    catalog: 'supported',
    customers: 'supported',
    inventory: 'supported',
    orderSync: 'supported',
    basketMode: 'local_only', // POS-local basket + post-payment order import
    discounts: 'not_recommended',
    giftCards: 'not_recommended',
    refunds: 'not_recommended',
    loyalty: 'not_recommended', // no loyalty API
    storeCredit: 'not_recommended', // no store credit API
  },
  [ECommercePlatform.COMMERCEFULL]: {
    catalog: 'supported',
    customers: 'supported',
    inventory: 'supported',
    orderSync: 'supported',
    basketMode: 'native_draft',
    discounts: 'supported',
    giftCards: 'supported',
    refunds: 'supported',
    loyalty: 'custom', // Commercefull has loyalty extension — custom adapter
    storeCredit: 'custom', // Commercefull has store credit extension — custom adapter
  },
  [ECommercePlatform.OFFLINE]: {
    catalog: 'supported',
    customers: 'supported',
    inventory: 'supported',
    orderSync: 'supported',
    basketMode: 'local_only',
    discounts: 'supported',
    giftCards: 'not_recommended',
    refunds: 'supported',
    loyalty: 'supported', // local-only loyalty is always available offline
    storeCredit: 'supported', // local-only store credit is always available offline
  },
};

/**
 * Get the capability profile for a platform.
 * Falls back to OFFLINE profile for unknown/null platforms.
 */
export function getPlatformCapabilities(platform: ECommercePlatform | string | null | undefined): PlatformCapabilities {
  if (!platform) return PLATFORM_CAPABILITY_MATRIX[ECommercePlatform.OFFLINE];
  return PLATFORM_CAPABILITY_MATRIX[platform as ECommercePlatform] ?? PLATFORM_CAPABILITY_MATRIX[ECommercePlatform.OFFLINE];
}

/**
 * Get the basket mode for a platform.
 */
export function getBasketMode(capabilities: PlatformCapabilities): BasketMode {
  return capabilities.basketMode;
}

/**
 * Returns true only when the feature is fully supported (no custom adapter needed).
 * Note: basketMode is not a CapabilityLevel — use getBasketMode() for it.
 */
export function supportsStrict(capabilities: PlatformCapabilities, feature: Exclude<keyof PlatformCapabilities, 'basketMode'>): boolean {
  return capabilities[feature] === 'supported';
}

/**
 * Returns true when the feature is supported or available via a custom adapter.
 */
export function supportsWithCustom(
  capabilities: PlatformCapabilities,
  feature: Exclude<keyof PlatformCapabilities, 'basketMode'>
): boolean {
  return capabilities[feature] === 'supported' || capabilities[feature] === 'custom';
}

/**
 * Returns true when the feature is explicitly not recommended for this platform.
 */
export function isNotRecommended(capabilities: PlatformCapabilities, feature: Exclude<keyof PlatformCapabilities, 'basketMode'>): boolean {
  return capabilities[feature] === 'not_recommended';
}

/**
 * Human-readable reason string for why a feature is unavailable.
 * Used in UI disabled states and tooltips.
 */
export function getUnavailableReason(
  capabilities: PlatformCapabilities,
  feature: Exclude<keyof PlatformCapabilities, 'basketMode'>,
  platformName: string
): string {
  const level = capabilities[feature];
  if (level === 'not_recommended') {
    return `${featureLabel(feature)} is not supported on ${platformName}.`;
  }
  if (level === 'custom') {
    return `${featureLabel(feature)} requires a custom adapter for ${platformName}. Contact your administrator.`;
  }
  return '';
}

function featureLabel(feature: Exclude<keyof PlatformCapabilities, 'basketMode'>): string {
  const labels: Record<Exclude<keyof PlatformCapabilities, 'basketMode'>, string> = {
    catalog: 'Catalog',
    customers: 'Customer management',
    inventory: 'Inventory sync',
    orderSync: 'Order sync',
    discounts: 'Discounts',
    giftCards: 'Gift cards',
    refunds: 'Refunds',
    loyalty: 'Loyalty points sync',
    storeCredit: 'Store credit sync',
  };
  return labels[feature];
}
