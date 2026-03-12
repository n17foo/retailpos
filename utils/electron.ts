import { Platform } from 'react-native';

/**
 * Extended window type for Electron environment
 */
interface ElectronWindow extends Window {
  isElectron?: boolean;
  electronAPI?: ElectronAPI;
}

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
    if ((window as ElectronWindow).isElectron === true) {
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
    return (window as ElectronWindow).electronAPI || null;
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

  // ── Printer IPC ──────────────────────────────────────────────
  /** Send raw bytes (base64-encoded) to a printer via Node.js net/usb/bt */
  printerSendRawData: (base64Data: string, config: ElectronPrinterConfig) => Promise<boolean>;
  /** Discover printers on the network (mDNS / SNMP) or USB bus */
  printerDiscover: () => Promise<Array<{ id: string; name: string; connectionType: string }>>;
  /** Get printer status */
  printerGetStatus: (config: ElectronPrinterConfig) => Promise<{ isOnline: boolean; hasPaper: boolean }>;

  // ── Scanner IPC ──────────────────────────────────────────────
  /** Subscribe to HID barcode scanner events from the main process */
  onBarcodeScan: (callback: (data: string) => void) => () => void;

  // ── Drawer IPC ───────────────────────────────────────────────
  /** Open cash drawer via printer kick or dedicated USB drawer */
  drawerOpen: (config: ElectronPrinterConfig, pin?: 2 | 5) => Promise<boolean>;
  /** Query drawer sensor status (if supported) */
  drawerIsOpen: (config: ElectronPrinterConfig) => Promise<boolean | undefined>;

  // ── Payment IPC ──────────────────────────────────────────────
  /** Initialise Stripe Terminal JS SDK in the main/renderer process */
  paymentInit: (config: { publishableKey: string; locationId: string }) => Promise<boolean>;
  /** Discover Stripe smart readers on the network */
  paymentDiscoverReaders: () => Promise<Array<{ id: string; name: string }>>;
  /** Connect to a Stripe smart reader */
  paymentConnectReader: (readerId: string) => Promise<boolean>;
  /** Collect payment */
  paymentCollect: (request: { amount: number; currency: string; reference: string }) => Promise<{
    success: boolean;
    transactionId?: string;
    errorMessage?: string;
    cardBrand?: string;
    last4?: string;
  }>;
  /** Cancel in-progress payment collection */
  paymentCancel: () => Promise<void>;
  /** Disconnect from reader */
  paymentDisconnect: () => Promise<void>;
}

/** Printer connection descriptor passed to Electron IPC */
export interface ElectronPrinterConfig {
  connectionType: 'network' | 'usb' | 'bluetooth';
  host?: string;
  port?: number;
  vendorId?: string;
  productId?: string;
  macAddress?: string;
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
