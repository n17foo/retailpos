/**
 * Pure responsive layout utilities extracted from useResponsive.
 * No React, no RN — fully testable in node.
 */

export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

/**
 * Returns the number of product grid columns for the given window width.
 * Used by non-sale screens; the sale screen uses getSaleLayout().productColumns(density).
 */
export function getProductColumns(width: number): number {
  if (width >= breakpoints.wide) return 5;
  if (width >= breakpoints.desktop) return 4;
  if (width >= breakpoints.tablet) return 3;
  return 2;
}

// ---------------------------------------------------------------------------
// Sale screen layout (docs/specs/system/sales-screen-fast-path-ux.md §4.8)
// ---------------------------------------------------------------------------

/** Device class derived from window width AND height — never from the device model */
export type SaleLayoutClass = 'phone' | 'phone-landscape' | 'tablet' | 'desktop' | 'wide';

/** stacked: catalogue full width + sticky basket bar; split: catalogue left, basket column right */
export type SaleShell = 'stacked' | 'split';

/** Product tile density */
export type TileDensity = 'large' | 'compact' | 'text';

/**
 * How the category buttons are laid out:
 *  - 'merged'  — a single strip: roots, with the selected root's children appended after it
 *  - 'strips'  — row 1 (roots) and row 2 (children) as separate horizontally scrolling strips
 *  - 'wrapped' — roots wrap onto up to two lines, children on a strip below
 */
export type CategoryMode = 'merged' | 'strips' | 'wrapped';

export interface SaleLayout {
  layoutClass: SaleLayoutClass;
  shell: SaleShell;
  /** Basket column width in the split shell (0 in the stacked shell) */
  basketWidth: number;
  topBarHeight: number;
  categoryMode: CategoryMode;
  /** Grid column count for a tile density */
  productColumns: (density: TileDensity) => number;
}

/** Below this window height the split-shell compact layout is forced (phone landscape) */
const SHORT_HEIGHT = 500;
/** Smallest width accepted for the short-height split layout */
const SHORT_MIN_WIDTH = 568;
/** Below this width the stacked (phone) shell is always used */
const PHONE_MAX_WIDTH = 600;

/**
 * Selects the sale-screen layout class from the current window size.
 * Re-evaluated on every window change (rotation, split view, desktop resize).
 *
 * | class            | condition                                   |
 * | ---------------- | ------------------------------------------- |
 * | phone            | width < 600, or width < 768 in portrait     |
 * | phone-landscape  | height < 500 and width >= 568               |
 * | tablet           | 768 <= width < 1024 (height >= 500)         |
 * | desktop          | 1024 <= width < 1440                        |
 * | wide             | width >= 1440                               |
 */
export function getSaleLayout(width: number, height: number): SaleLayout {
  const layoutClass = getSaleLayoutClass(width, height);

  switch (layoutClass) {
    case 'phone':
      return {
        layoutClass,
        shell: 'stacked',
        basketWidth: 0,
        topBarHeight: 48,
        categoryMode: 'strips',
        productColumns: density => (density === 'text' ? 1 : 2),
      };
    case 'phone-landscape':
      return {
        layoutClass,
        shell: 'split',
        basketWidth: Math.max(280, Math.round(width * 0.38)),
        topBarHeight: 40,
        categoryMode: 'merged',
        productColumns: density => (density === 'text' ? 1 : 3),
      };
    case 'tablet':
      return {
        layoutClass,
        shell: 'split',
        basketWidth: 300,
        topBarHeight: 48,
        categoryMode: 'wrapped',
        productColumns: density => (density === 'text' ? 4 : density === 'large' ? 2 : 3),
      };
    case 'desktop':
      return {
        layoutClass,
        shell: 'split',
        basketWidth: 340,
        topBarHeight: 48,
        categoryMode: 'wrapped',
        productColumns: density => (density === 'text' ? 6 : density === 'large' ? 3 : 4),
      };
    case 'wide':
      return {
        layoutClass,
        shell: 'split',
        basketWidth: 420,
        topBarHeight: 48,
        categoryMode: 'wrapped',
        productColumns: density => (density === 'text' ? 8 : density === 'large' ? 4 : 6),
      };
  }
}

export function getSaleLayoutClass(width: number, height: number): SaleLayoutClass {
  // Short screens (phones in landscape, very small windows) get the compact split shell
  if (height < SHORT_HEIGHT && width >= SHORT_MIN_WIDTH) {
    return 'phone-landscape';
  }

  const portrait = height >= width;
  if (width < PHONE_MAX_WIDTH || (width < breakpoints.tablet && portrait)) {
    return 'phone';
  }

  if (width < breakpoints.tablet) {
    // 600-767px in landscape — too narrow for the phone shell, too small for desktop
    return 'tablet';
  }
  if (width < breakpoints.desktop) {
    return 'tablet';
  }
  if (width < breakpoints.wide) {
    return 'desktop';
  }
  return 'wide';
}
