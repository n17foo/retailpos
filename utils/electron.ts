import { Platform } from 'react-native';

/**
 * Utility to detect if the app is running in Electron desktop environment
 */

// Check if running in Electron
export const isElectron = (): boolean => {
  // Check if we're in a web environment first
  if (Platform.OS !== 'web') {
    return false;
  }

  // Check for Electron-specific globals
  if (typeof window !== 'undefined') {
    // Check for electronAPI exposed via preload script
    if ((window as any).isElectron === true) {
      return true;
    }

    // Check for Electron in user agent (fallback)
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      return navigator.userAgent.toLowerCase().includes('electron');
    }
  }

  return false;
};

/**
 * Get the current platform type
 */
export type PlatformType = 'ios' | 'android' | 'web' | 'desktop';

export const getPlatformType = (): PlatformType => {
  if (isElectron()) {
    return 'desktop';
  }

  switch (Platform.OS) {
    case 'ios':
      return 'ios';
    case 'android':
      return 'android';
    case 'web':
      return 'web';
    default:
      return 'web';
  }
};

/**
 * Check if running on mobile (iOS or Android)
 */
export const isMobile = (): boolean => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

/**
 * Check if running on web (browser or Electron)
 */
export const isWeb = (): boolean => {
  return Platform.OS === 'web';
};

/**
 * Get Electron API if available
 */
export const getElectronAPI = (): ElectronAPI | null => {
  if (isElectron() && typeof window !== 'undefined') {
    return (window as any).electronAPI || null;
  }
  return null;
};

/**
 * Electron API type definition
 */
export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isElectron: boolean;
}

/**
 * Window controls for Electron
 */
export const windowControls = {
  minimize: async () => {
    const api = getElectronAPI();
    if (api) {
      await api.minimizeWindow();
    }
  },
  maximize: async () => {
    const api = getElectronAPI();
    if (api) {
      await api.maximizeWindow();
    }
  },
  close: async () => {
    const api = getElectronAPI();
    if (api) {
      await api.closeWindow();
    }
  },
};

/**
 * Get app version (works for both Electron and React Native)
 */
export const getAppVersion = async (): Promise<string> => {
  const api = getElectronAPI();
  if (api) {
    return api.getAppVersion();
  }
  // For React Native, you might use expo-constants or similar
  return '1.0.0';
};
