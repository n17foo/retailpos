import { keyValueRepository } from '../../../../shared/repositories/KeyValueRepository';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { ScannerType } from './ScannerServiceFactory';

const SCANNER_SETTINGS_KEY = 'scannerSettings';

/**
 * BLE UUID presets for common barcode scanner models
 */
export const BLE_SCANNER_PRESETS = {
  microchip_rn4020: {
    name: 'Microchip RN4020 (Generic)',
    serviceUUID: '49535343-FE7D-4AE5-8FA9-9FAFD205E455',
    characteristicUUID: '49535343-8841-43F4-A8D4-ECBE34729BB3',
  },
  zebra_cs4070: {
    name: 'Zebra CS4070',
    serviceUUID: '00001101-0000-1000-8000-00805F9B34FB',
    characteristicUUID: '00002A00-0000-1000-8000-00805F9B34FB',
  },
  honeywell_1902: {
    name: 'Honeywell 1902',
    serviceUUID: '0000FFF0-0000-1000-8000-00805F9B34FB',
    characteristicUUID: '0000FFF1-0000-1000-8000-00805F9B34FB',
  },
  socket_s700: {
    name: 'Socket Mobile S700',
    serviceUUID: 'FFF0',
    characteristicUUID: 'FFF1',
  },
  custom: {
    name: 'Custom Configuration',
    serviceUUID: '',
    characteristicUUID: '',
  },
} as const;

export type BleScannerPreset = keyof typeof BLE_SCANNER_PRESETS;

/**
 * Scanner configuration interface
 */
export interface ScannerSettings {
  // Active scanner type
  activeType: ScannerType | null;

  // Last connected device ID per scanner type
  lastConnectedDevices: {
    [K in ScannerType]?: string;
  };

  // Bluetooth scanner configuration
  bluetooth: {
    preset: BleScannerPreset;
    serviceUUID: string;
    characteristicUUID: string;
    // Device name patterns to show in discovery (empty = show all)
    deviceNamePatterns: string[];
  };

  // USB scanner configuration
  usb: {
    scanIntervalMs: number;
    minBarcodeLength: number;
    maxBarcodeLength: number;
    suffixChar: 'Enter' | 'Tab';
  };

  // Camera scanner configuration
  camera: {
    preferredCamera: 'back' | 'front';
    enableTorch: boolean;
  };
}

const DEFAULT_SCANNER_SETTINGS: ScannerSettings = {
  activeType: null,
  lastConnectedDevices: {},
  bluetooth: {
    preset: 'microchip_rn4020',
    serviceUUID: BLE_SCANNER_PRESETS.microchip_rn4020.serviceUUID,
    characteristicUUID: BLE_SCANNER_PRESETS.microchip_rn4020.characteristicUUID,
    deviceNamePatterns: ['scanner', 'barcode', 'reader', 'zebra', 'honeywell', 'socket'],
  },
  usb: {
    scanIntervalMs: 80,
    minBarcodeLength: 3,
    maxBarcodeLength: 128,
    suffixChar: 'Enter',
  },
  camera: {
    preferredCamera: 'back',
    enableTorch: false,
  },
};

/**
 * Service for managing scanner settings and persistence
 */
export class ScannerSettingsService {
  private static instance: ScannerSettingsService;
  private logger = LoggerFactory.getInstance().createLogger('ScannerSettingsService');
  private settings: ScannerSettings = DEFAULT_SCANNER_SETTINGS;
  private initialized = false;

  private constructor() {}

  static getInstance(): ScannerSettingsService {
    if (!ScannerSettingsService.instance) {
      ScannerSettingsService.instance = new ScannerSettingsService();
    }
    return ScannerSettingsService.instance;
  }

  /**
   * Load scanner settings from storage. Call once at app startup.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const saved = await keyValueRepository.getObject<ScannerSettings>(SCANNER_SETTINGS_KEY);
      if (saved) {
        this.settings = { ...DEFAULT_SCANNER_SETTINGS, ...saved };
        this.logger.info('Scanner settings loaded from storage');
      }
      this.initialized = true;
    } catch (error) {
      this.logger.error({ message: 'Failed to load scanner settings' }, error instanceof Error ? error : new Error(String(error)));
      this.settings = DEFAULT_SCANNER_SETTINGS;
      this.initialized = true;
    }
  }

  /**
   * Get current scanner settings
   */
  getSettings(): ScannerSettings {
    return { ...this.settings };
  }

  /**
   * Update scanner settings and persist to storage
   */
  async updateSettings(updates: Partial<ScannerSettings>): Promise<void> {
    this.settings = {
      ...this.settings,
      ...updates,
      bluetooth: { ...this.settings.bluetooth, ...updates.bluetooth },
      usb: { ...this.settings.usb, ...updates.usb },
      camera: { ...this.settings.camera, ...updates.camera },
      lastConnectedDevices: { ...this.settings.lastConnectedDevices, ...updates.lastConnectedDevices },
    };
    await keyValueRepository.setObject(SCANNER_SETTINGS_KEY, this.settings);
    this.logger.info('Scanner settings updated and persisted');
  }

  /**
   * Set the active scanner type
   */
  async setActiveType(type: ScannerType | null): Promise<void> {
    this.settings.activeType = type;
    await keyValueRepository.setObject(SCANNER_SETTINGS_KEY, this.settings);
  }

  /**
   * Get the active scanner type
   */
  getActiveType(): ScannerType | null {
    return this.settings.activeType;
  }

  /**
   * Save the last connected device ID for a scanner type
   */
  async setLastConnectedDevice(type: ScannerType, deviceId: string): Promise<void> {
    this.settings.lastConnectedDevices[type] = deviceId;
    await keyValueRepository.setObject(SCANNER_SETTINGS_KEY, this.settings);
  }

  /**
   * Get the last connected device ID for a scanner type
   */
  getLastConnectedDevice(type: ScannerType): string | null {
    return this.settings.lastConnectedDevices[type] ?? null;
  }

  /**
   * Apply a BLE scanner preset
   */
  async applyBlePreset(preset: BleScannerPreset): Promise<void> {
    const presetConfig = BLE_SCANNER_PRESETS[preset];
    this.settings.bluetooth = {
      ...this.settings.bluetooth,
      preset,
      serviceUUID: presetConfig.serviceUUID,
      characteristicUUID: presetConfig.characteristicUUID,
    };
    await keyValueRepository.setObject(SCANNER_SETTINGS_KEY, this.settings);
    this.logger.info(`Applied BLE preset: ${preset}`);
  }

  /**
   * Set custom BLE UUIDs
   */
  async setCustomBleUUIDs(serviceUUID: string, characteristicUUID: string): Promise<void> {
    this.settings.bluetooth = {
      ...this.settings.bluetooth,
      preset: 'custom',
      serviceUUID,
      characteristicUUID,
    };
    await keyValueRepository.setObject(SCANNER_SETTINGS_KEY, this.settings);
    this.logger.info('Custom BLE UUIDs configured');
  }

  /**
   * Get BLE configuration
   */
  getBluetoothConfig(): { serviceUUID: string; characteristicUUID: string } {
    return {
      serviceUUID: this.settings.bluetooth.serviceUUID,
      characteristicUUID: this.settings.bluetooth.characteristicUUID,
    };
  }

  /**
   * Get USB configuration
   */
  getUsbConfig(): ScannerSettings['usb'] {
    return { ...this.settings.usb };
  }

  /**
   * Check if a device name matches configured patterns
   */
  matchesDevicePattern(deviceName: string): boolean {
    if (this.settings.bluetooth.deviceNamePatterns.length === 0) {
      return true; // Show all devices if no patterns configured
    }

    const lowerName = deviceName.toLowerCase();
    return this.settings.bluetooth.deviceNamePatterns.some(pattern => lowerName.includes(pattern.toLowerCase()));
  }
}

export const scannerSettingsService = ScannerSettingsService.getInstance();
