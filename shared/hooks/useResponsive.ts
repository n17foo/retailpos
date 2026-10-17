import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import { breakpoints, getProductColumns } from '../utils/responsive.utils';

export { breakpoints, getProductColumns };

export type DeviceSize = 'mobile' | 'tablet' | 'desktop' | 'wide';

export interface ResponsiveInfo {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  isTabletOrDesktop: boolean;
  deviceSize: DeviceSize;
}

/**
 * Hook that provides responsive breakpoint information based on window dimensions.
 * Updates automatically when the window is resized.
 *
 * This hook is dimension-only. For environment detection (Electron vs browser
 * vs native) alongside dimensions, use `usePlatform()` from hooks/usePlatform.ts.
 */
export const useResponsive = (): ResponsiveInfo => {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isMobile = width < breakpoints.tablet;
    const isTablet = width >= breakpoints.tablet && width < breakpoints.desktop;
    const isDesktop = width >= breakpoints.desktop;
    const isWide = width >= breakpoints.wide;
    const isTabletOrDesktop = width >= breakpoints.tablet;

    let deviceSize: DeviceSize = 'mobile';
    if (isWide) deviceSize = 'wide';
    else if (isDesktop) deviceSize = 'desktop';
    else if (isTablet) deviceSize = 'tablet';

    return { width, height, isMobile, isTablet, isDesktop, isWide, isTabletOrDesktop, deviceSize };
  }, [width, height]);
};
