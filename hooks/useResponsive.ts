import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

/**
 * Breakpoint thresholds (in pixels)
 */
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export type DeviceSize = 'mobile' | 'tablet' | 'desktop' | 'wide';

export interface ResponsiveInfo {
  /** Current window width */
  width: number;
  /** Current window height */
  height: number;
  /** True when width < 768 */
  isMobile: boolean;
  /** True when 768 <= width < 1024 */
  isTablet: boolean;
  /** True when width >= 1024 */
  isDesktop: boolean;
  /** True when width >= 1440 */
  isWide: boolean;
  /** True when width >= 768 (tablet or larger) */
  isTabletOrDesktop: boolean;
  /** Current device size category */
  deviceSize: DeviceSize;
}

/**
 * Hook that provides responsive breakpoint information based on window dimensions.
 * Updates automatically when the window is resized.
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

    return {
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      isWide,
      isTabletOrDesktop,
      deviceSize,
    };
  }, [width, height]);
};

/**
 * Returns the number of product grid columns for the current width.
 */
export const getProductColumns = (width: number): number => {
  if (width >= breakpoints.wide) return 5;
  if (width >= breakpoints.desktop) return 4;
  if (width >= breakpoints.tablet) return 3;
  return 2;
};

/**
 * Returns responsive sidebar widths.
 */
export const getSidebarWidths = (width: number) => {
  if (width >= breakpoints.wide) {
    return { category: 300, basket: 380 };
  }
  if (width >= breakpoints.desktop) {
    return { category: 260, basket: 340 };
  }
  if (width >= breakpoints.tablet) {
    return { category: 230, basket: 300 };
  }
  return { category: 0, basket: 0 };
};

export default useResponsive;
