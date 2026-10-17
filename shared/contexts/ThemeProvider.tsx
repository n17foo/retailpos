/**
 * ThemeProvider
 *
 * Provides the active theme colors to the entire component tree.
 * Components call `useTheme().colors` instead of importing `lightColors`
 * directly so the whole UI re-renders when the user switches themes.
 *
 * The selected theme id is persisted to the key-value store under
 * `'app.theme'` so it survives app restarts.
 *
 * Usage:
 *   const { colors, themeId, setTheme } = useTheme();
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { keyValueRepository } from '../repositories/KeyValueRepository';
import { LoggerFactory } from '../services/logger/LoggerFactory';
import { ThemeId, ThemeColors, ThemePreset, DEFAULT_THEME_ID, getThemePreset, THEME_PRESETS } from '../utils/themes';

const THEME_STORAGE_KEY = 'app.theme';
const logger = LoggerFactory.getInstance().createLogger('ThemeProvider');

export interface ThemeContextValue {
  /** Active color palette — use this everywhere instead of `lightColors` */
  colors: ThemeColors;
  /** Full preset including name, description, swatch */
  preset: ThemePreset;
  /** Active theme id */
  themeId: ThemeId;
  /** Switch to a different theme and persist the choice */
  setTheme: (id: ThemeId) => Promise<void>;
  /** True while the persisted theme is being loaded on first mount */
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted theme on mount
  useEffect(() => {
    keyValueRepository
      .getItem(THEME_STORAGE_KEY)
      .then(stored => {
        if (stored && stored in THEME_PRESETS) {
          setThemeId(stored as ThemeId);
        }
      })
      .catch(err => {
        logger.warn({ message: 'Failed to load persisted theme, using default', ...err });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const setTheme = useCallback(async (id: ThemeId) => {
    try {
      setThemeId(id);
      await keyValueRepository.setItem(THEME_STORAGE_KEY, id);
      logger.info({ message: `Theme changed to: ${id}` });
    } catch (err) {
      logger.error({ message: 'Failed to persist theme selection' }, err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const preset = getThemePreset(themeId);
    return { colors: preset.colors, preset, themeId, setTheme, isLoading };
  }, [themeId, setTheme, isLoading]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
