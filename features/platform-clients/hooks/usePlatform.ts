/**
 * usePlatform
 *
 * Single hook that combines Electron detection with responsive breakpoints.
 * Use this instead of mixing `isElectron()` calls with `useResponsive()` in
 * components that need to branch on runtime environment.
 *
 * Key distinction this hook makes explicit:
 *
 *   isElectron  — the app is running inside Electron (desktop OS, IPC available,
 *                 keyboard shortcuts meaningful, window controls available).
 *                 True regardless of window width.
 *
 *   isDesktop   — window width ≥ 1024px. A small Electron window can have
 *                 isDesktop=false while isElectron=true. A large browser tab
 *                 can have isDesktop=true while isElectron=false.
 *
 *   isNative    — running on iOS or Android (Platform.OS is 'ios' or 'android').
 *
 * Layout decisions  → use isDesktop / isTablet / isMobile (dimension-based)
 * Hardware/IPC      → use isElectron (environment-based)
 * Touch vs pointer  → use isNative (OS-based)
 */

import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useResponsive, DeviceSize } from '../../../shared/hooks/useResponsive';
import { isElectron as detectElectron, getPlatformType, PlatformType } from '../../../shared/utils/electron';

export interface PlatformInfo {
  // ── Environment ──────────────────────────────────────────────────────────
  /** True when running inside Electron (desktop OS, IPC available) */
  isElectron: boolean;
  /** True when running on iOS or Android */
  isNative: boolean;
  /** True when running in a browser (not Electron, not native) */
  isBrowser: boolean;
  /** Canonical platform type: 'ios' | 'android' | 'web' | 'desktop' */
  platformType: PlatformType;

  // ── Dimensions (from useResponsive) ──────────────────────────────────────
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  isTabletOrDesktop: boolean;
  deviceSize: DeviceSize;

  // ── Capability flags ─────────────────────────────────────────────────────
  /** Keyboard shortcuts are meaningful (Electron or browser) */
  hasKeyboard: boolean;
  /** Window controls (minimize/maximize/close) are available via IPC */
  hasWindowControls: boolean;
  /** Hardware IPC (printer, scanner, drawer, payment) is available */
  hasHardwareIpc: boolean;
  /** Camera barcode scanning is available (native only) */
  hasCameraScanner: boolean;
  /** Bluetooth scanning is available (native only) */
  hasBluetoothScanner: boolean;
  /** Biometric auth is available (native only) */
  hasBiometrics: boolean;
  /** NFC tap-to-pay is available (native only, iOS 15.4+ / Android 11+) */
  hasNfcPayment: boolean;
}

/**
 * Returns a stable platform info object. Re-evaluates only when window
 * dimensions change (Electron/native flags are constant per session).
 */
export const usePlatform = (): PlatformInfo => {
  const responsive = useResponsive();

  return useMemo(() => {
    const electron = detectElectron();
    const native = Platform.OS === 'ios' || Platform.OS === 'android';
    const browser = Platform.OS === 'web' && !electron;
    const platformType = getPlatformType();

    return {
      // Environment
      isElectron: electron,
      isNative: native,
      isBrowser: browser,
      platformType,

      // Dimensions — pass through from useResponsive
      width: responsive.width,
      height: responsive.height,
      isMobile: responsive.isMobile,
      isTablet: responsive.isTablet,
      isDesktop: responsive.isDesktop,
      isWide: responsive.isWide,
      isTabletOrDesktop: responsive.isTabletOrDesktop,
      deviceSize: responsive.deviceSize,

      // Capability flags
      hasKeyboard: Platform.OS === 'web', // true for both Electron and browser
      hasWindowControls: electron,
      hasHardwareIpc: electron,
      hasCameraScanner: native,
      hasBluetoothScanner: native,
      hasBiometrics: native,
      hasNfcPayment: native,
    };
  }, [responsive]);
};
