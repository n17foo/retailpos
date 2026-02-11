/**
 * ============================================================================
 * usePlatformServices
 * ============================================================================
 * Unified hook that resolves every domain service for the active platform.
 *
 * Usage:
 *   const { product, category, order, inventory, search, refund, basket, token }
 *     = usePlatformServices();
 *
 * The hook reads the current platform from useEcommerceSettings and delegates
 * to the PlatformServiceRegistry singleton.
 * ============================================================================
 */

import { useMemo } from 'react';
import { ECommercePlatform } from '../utils/platforms';
import { PlatformServiceRegistry, PlatformServices } from '../services/platform';
import { useEcommerceSettings } from './useEcommerceSettings';

// Re-export for convenience so consumers don't need an extra import
export type { PlatformServices } from '../services/platform';

/**
 * Return type adds the resolved platform for downstream reference.
 */
export interface UsePlatformServicesReturn extends PlatformServices {
  /** Whether an online platform is configured */
  isOnline: boolean;
}

/**
 * Resolve all domain services for the currently-configured e-commerce platform.
 *
 * @param overridePlatform  Pass a platform explicitly to bypass settings.
 */
export function usePlatformServices(overridePlatform?: ECommercePlatform): UsePlatformServicesReturn {
  const { currentPlatform } = useEcommerceSettings();

  const platform = overridePlatform ?? currentPlatform ?? ECommercePlatform.OFFLINE;

  const services = useMemo(() => {
    return PlatformServiceRegistry.getInstance().getServices(platform);
  }, [platform]);

  const isOnline = platform !== ECommercePlatform.OFFLINE;

  return useMemo(
    () => ({
      ...services,
      isOnline,
    }),
    [services, isOnline]
  );
}

export default usePlatformServices;
