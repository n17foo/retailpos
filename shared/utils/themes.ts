/**
 * Theme Presets
 *
 * Each theme is a complete color palette that replaces `lightColors`.
 * Components call `useTheme().colors` instead of importing `lightColors`
 * directly so the whole UI re-renders when the user switches themes.
 *
 * Relationship with utils/theme.ts
 * ─────────────────────────────────
 * `utils/theme.ts` is the single source of truth for the base palette
 * (lightColors), spacing, typography, elevation, and semantic colors.
 * `utils/themes.ts` owns the preset registry and the ThemeColors interface.
 *
 * `defaultColors` is derived directly from `lightColors` — no duplication.
 * All other presets spread `defaultColors` and override only what changes.
 */

import { lightColors } from './theme';

export type ThemeId = 'default' | 'dark' | 'ocean' | 'forest' | 'sunset' | 'slate' | 'rose' | 'amber';

/**
 * The full color contract every theme must satisfy.
 * Typed to match the shape of `lightColors` so TypeScript catches any drift.
 */
export type ThemeColors = typeof lightColors;

export interface ThemePreset {
  id: ThemeId;
  name: string;
  description: string;
  /** Swatch colors shown in the picker (primary, secondary, background) */
  swatch: [string, string, string];
  isDark: boolean;
  colors: ThemeColors;
}

// ─── Default — derived directly from lightColors (single source of truth) ────

const defaultColors: ThemeColors = lightColors;

// ─── Dark ─────────────────────────────────────────────────────────────────────

const darkColors: ThemeColors = {
  ...defaultColors,
  primary: '#90CAF9',
  primaryDark: '#64B5F6',
  primaryLight: '#1976D2',
  secondary: '#FFCC80',
  secondaryDark: '#FFB74D',
  secondaryLight: '#F57C00',
  background: '#121212',
  surface: '#1E1E1E',
  error: '#CF6679',
  success: '#81C784',
  warning: '#FFD54F',
  info: '#64B5F6',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textHint: '#808080',
  textDisabled: '#6E6E6E',
  textOnPrimary: '#000000',
  textOnSecondary: '#000000',
  border: '#2C2C2C',
  divider: '#2C2C2C',
  inputBackground: '#2C2C2C',
  keypadButton: '#2C2C2C',
  statusOnline: '#81C784',
  statusOffline: '#E57373',
  statusWarning: '#FFD54F',
  hover: '#1A2733',
  active: '#1E3A5F',
  focus: '#1565C0',
  disabled: '#6E6E6E',
  warningBackground: '#3E2E00',
  warningText: '#FFD54F',
  successBackground: '#1B3A1F',
  successText: '#81C784',
  overlay: 'rgba(0,0,0,0.7)',
  overlayDark: 'rgba(0,0,0,0.85)',
  overlayLight: 'rgba(0,0,0,0.6)',
  outOfStockOverlay: 'rgba(255,0,0,0.4)',
  whiteOverlayLight: 'rgba(255,255,255,0.08)',
  whiteOverlayMedium: 'rgba(255,255,255,0.12)',
  whiteOverlayDark: 'rgba(255,255,255,0.2)',
};

// ─── Ocean (teal + deep blue) ─────────────────────────────────────────────────

const oceanColors: ThemeColors = {
  ...defaultColors,
  primary: '#0077B6',
  primaryDark: '#005F8E',
  primaryLight: '#ADE8F4',
  secondary: '#00B4D8',
  secondaryDark: '#0096C7',
  secondaryLight: '#CAF0F8',
  background: '#F0F8FF',
  surface: '#FFFFFF',
  hover: '#E0F4FF',
  active: '#ADE8F4',
  focus: '#90E0EF',
  info: '#0077B6',
};

// ─── Forest (green + earthy brown) ───────────────────────────────────────────

const forestColors: ThemeColors = {
  ...defaultColors,
  primary: '#2D6A4F',
  primaryDark: '#1B4332',
  primaryLight: '#B7E4C7',
  secondary: '#74C69D',
  secondaryDark: '#52B788',
  secondaryLight: '#D8F3DC',
  background: '#F4F9F4',
  surface: '#FFFFFF',
  hover: '#D8F3DC',
  active: '#B7E4C7',
  focus: '#95D5B2',
  info: '#2D6A4F',
};

// ─── Sunset (warm coral + amber) ─────────────────────────────────────────────

const sunsetColors: ThemeColors = {
  ...defaultColors,
  primary: '#E63946',
  primaryDark: '#C1121F',
  primaryLight: '#FFCCD5',
  secondary: '#F4A261',
  secondaryDark: '#E76F51',
  secondaryLight: '#FFE8D6',
  background: '#FFF8F5',
  surface: '#FFFFFF',
  hover: '#FFE8D6',
  active: '#FFCCD5',
  focus: '#FFB3C1',
  info: '#E63946',
};

// ─── Slate (professional grey-blue) ──────────────────────────────────────────

const slateColors: ThemeColors = {
  ...defaultColors,
  primary: '#334155',
  primaryDark: '#1E293B',
  primaryLight: '#CBD5E1',
  secondary: '#64748B',
  secondaryDark: '#475569',
  secondaryLight: '#E2E8F0',
  background: '#F1F5F9',
  surface: '#FFFFFF',
  hover: '#E2E8F0',
  active: '#CBD5E1',
  focus: '#94A3B8',
  info: '#334155',
};

// ─── Rose (elegant pink + plum) ──────────────────────────────────────────────

const roseColors: ThemeColors = {
  ...defaultColors,
  primary: '#9D174D',
  primaryDark: '#831843',
  primaryLight: '#FBCFE8',
  secondary: '#DB2777',
  secondaryDark: '#BE185D',
  secondaryLight: '#FCE7F3',
  background: '#FFF5F7',
  surface: '#FFFFFF',
  hover: '#FCE7F3',
  active: '#FBCFE8',
  focus: '#F9A8D4',
  info: '#9D174D',
};

// ─── Amber (warm gold + brown) ────────────────────────────────────────────────

const amberColors: ThemeColors = {
  ...defaultColors,
  primary: '#B45309',
  primaryDark: '#92400E',
  primaryLight: '#FDE68A',
  secondary: '#D97706',
  secondaryDark: '#B45309',
  secondaryLight: '#FEF3C7',
  background: '#FFFBEB',
  surface: '#FFFFFF',
  hover: '#FEF3C7',
  active: '#FDE68A',
  focus: '#FCD34D',
  info: '#B45309',
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'Clean blue and orange — the original RetailPOS look',
    swatch: ['#2196F3', '#FF9800', '#F5F5F5'],
    isDark: false,
    colors: defaultColors,
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Easy on the eyes in low-light environments',
    swatch: ['#90CAF9', '#FFCC80', '#121212'],
    isDark: true,
    colors: darkColors,
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep teal and blue — calm and professional',
    swatch: ['#0077B6', '#00B4D8', '#F0F8FF'],
    isDark: false,
    colors: oceanColors,
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Natural greens — great for food and wellness businesses',
    swatch: ['#2D6A4F', '#74C69D', '#F4F9F4'],
    isDark: false,
    colors: forestColors,
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm coral and amber — energetic and inviting',
    swatch: ['#E63946', '#F4A261', '#FFF8F5'],
    isDark: false,
    colors: sunsetColors,
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    description: 'Neutral grey-blue — understated and corporate',
    swatch: ['#334155', '#64748B', '#F1F5F9'],
    isDark: false,
    colors: slateColors,
  },
  rose: {
    id: 'rose',
    name: 'Rose',
    description: 'Elegant pink and plum — boutique and beauty',
    swatch: ['#9D174D', '#DB2777', '#FFF5F7'],
    isDark: false,
    colors: roseColors,
  },
  amber: {
    id: 'amber',
    name: 'Amber',
    description: 'Warm gold and brown — artisan and café',
    swatch: ['#B45309', '#D97706', '#FFFBEB'],
    isDark: false,
    colors: amberColors,
  },
};

export const DEFAULT_THEME_ID: ThemeId = 'default';

/** Ordered list for the picker UI */
export const THEME_ORDER: ThemeId[] = ['default', 'dark', 'ocean', 'forest', 'sunset', 'slate', 'rose', 'amber'];

/** Resolve a theme by id, falling back to default */
export function getThemePreset(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS[(id as ThemeId) ?? DEFAULT_THEME_ID] ?? THEME_PRESETS[DEFAULT_THEME_ID];
}
