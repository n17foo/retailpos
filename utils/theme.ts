import type { ViewStyle } from 'react-native';

export const lightColors = {
  // Primary colors
  primary: '#2196F3',
  primaryDark: '#1976D2',
  primaryLight: '#BBDEFB',

  // Secondary colors
  secondary: '#FF9800',
  secondaryDark: '#F57C00',
  secondaryLight: '#FFE0B2',

  // UI colors
  background: '#F5F5F5',
  surface: '#FFFFFF',
  error: '#B00020',
  success: '#4CAF50',
  warning: '#FFC107',
  info: '#2196F3',

  // Text colors
  textPrimary: '#212121',
  textSecondary: '#757575',
  textHint: '#9E9E9E',
  textDisabled: '#BDBDBD',
  textOnPrimary: '#FFFFFF',
  textOnSecondary: '#000000',

  // Border and divider colors
  border: '#E0E0E0',
  divider: '#EEEEEE',

  // Input and control colors
  inputBackground: '#F5F5F5',
  keypadButton: '#F0F0F0',

  // Status indicators
  statusOnline: '#4CAF50',
  statusOffline: '#F44336',
  statusWarning: '#FFC107',

  // Interactive states
  hover: '#E3F2FD',
  active: '#BBDEFB',
  focus: '#90CAF9',
  disabled: '#BDBDBD',

  // Status backgrounds
  warningBackground: '#fff3cd',
  warningText: '#856404',
  successBackground: '#d4edda',
  errorBackground: '#ffebee',
  successText: '#155724',

  // Overlay colors
  overlay: 'rgba(0,0,0,0.5)',
  overlayDark: 'rgba(0,0,0,0.7)',
  overlayLight: 'rgba(0,0,0,0.45)',
  outOfStockOverlay: 'rgba(255, 0, 0, 0.5)',
  transparent: 'transparent',
  whiteOverlayLight: 'rgba(255, 255, 255, 0.2)',
  whiteOverlayMedium: 'rgba(255, 255, 255, 0.3)',
  whiteOverlayDark: 'rgba(255, 255, 255, 0.5)',

  // Pointer affordances (mouse/keyboard input mode)
  focusRing: '#2196F3',
  pressed: '#CCE4F7',
};

export const darkHoverTokens = {
  hover: 'rgba(255,255,255,0.08)',
  pressed: 'rgba(255,255,255,0.16)',
  focusRing: '#90CAF9',
};

export const darkColors = {
  // Primary colors
  primary: '#90CAF9',
  primaryDark: '#64B5F6',
  primaryLight: '#1976D2',

  // Secondary colors
  secondary: '#FFCC80',
  secondaryDark: '#FFB74D',
  secondaryLight: '#F57C00',

  // UI colors
  background: '#121212',
  surface: '#1E1E1E',
  error: '#CF6679',
  success: '#81C784',
  warning: '#FFD54F',
  info: '#64B5F6',

  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textHint: '#808080',
  textDisabled: '#6E6E6E',
  textOnPrimary: '#000000',
  textOnSecondary: '#000000',

  // Border and divider colors
  border: '#2C2C2C',
  divider: '#2C2C2C',

  // Input and control colors
  inputBackground: '#2C2C2C',
  keypadButton: '#2C2C2C',

  // Status indicators
  statusOnline: '#81C784',
  statusOffline: '#E57373',
  statusWarning: '#FFD54F',

  // Overlay colors
  overlay: 'rgba(0,0,0,0.7)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  round: 9999,
};

export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
  },
};

/**
 * Semantic colors for status, interactive states, and platform branding
 */
export const semanticColors = {
  // Status
  success: lightColors.success,
  warning: lightColors.warning,
  error: lightColors.error,
  info: lightColors.info,

  // Interactive states
  hover: lightColors.hover,

  // Info colors
  infoBackground: '#e7f3ff',
  infoText: '#0056b3',

  // Receipt colors
  receiptPaper: '#FFFFF0',

  // Platform branding
  shopify: '#96BF48',
  woocommerce: '#7F54B3',
  bigcommerce: '#34313F',
  magento: '#EE672F',
  sylius: '#1ABE5D',
  wix: '#0C6EFC',
  prestashop: '#DF0067',
  commercefull: '#4A55A2',
  offline: '#9E9E9E',
};

/**
 * Layout constants
 */
export const layout = {
  headerHeight: 48,
};

/**
 * Minimum hit-target sizes per input mode (spec §4.8.3).
 * Touch gets larger targets than mouse/pointer input.
 */
export const hitTarget = {
  touchMin: 48,
  touchTender: 56,
  pointerMin: 40,
  pointerTender: 44,
};

export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  low: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 3,
  },
  high: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 6,
  },
};

/**
 * Interactive-state styles for Pressable's style callback.
 *
 * `hovered`/`focused` exist at runtime on web/Electron but are not in RN's
 * PressableStateCallbackType — the cast is contained here. `pressed` fires
 * on every platform. The rings use CSS `outline` so they never shift layout.
 */
export const interactionStyle = (state: { pressed: boolean }): ViewStyle => {
  const { pressed, hovered, focused } = state as { pressed: boolean; hovered?: boolean; focused?: boolean };
  if (pressed) return { opacity: 0.85 };
  if (focused) {
    return { outlineStyle: 'solid', outlineColor: lightColors.focusRing, outlineWidth: 2, outlineOffset: 1 };
  }
  if (hovered) {
    return { outlineStyle: 'solid', outlineColor: lightColors.focusRing, outlineWidth: 1, outlineOffset: 1 };
  }
  return {};
};
