import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { ScannerServiceInterface } from './ScannerServiceInterface';

/**
 * QR Hardware Scanner Service — dedicated USB/Bluetooth QR code reader for desktop.
 *
 * Desktop apps have no camera access, so a physical QR scanner is required.
 * These devices typically behave as HID keyboard input (like USB barcode scanners)
 * but are optimised for reading 2D QR codes in addition to 1D barcodes.
 *
 * Connection types:
 *  - USB HID (most common for desktop POS)
 *  - Bluetooth SPP (serial profile)
 *
 * The service listens for keyboard-style input terminated by Enter/Return,
 * which is the standard output mode for handheld QR scanners.
 */
const SCAN_INTERVAL_MS = 80;
const MIN_BARCODE_LENGTH = 3;

export class QRHardwareScannerService implements ScannerServiceInterface {
  private connected: boolean = false;
  private deviceId: string | null = null;
  private scanListeners: Map<string, (data: string) => void> = new Map();
  private inputBuffer: string = '';
  private lastKeyTime: number = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;

  constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('QRHardwareScannerService');
  }

  /**
   * Connect to a QR hardware scanner device.
   * Most USB QR scanners are HID devices — the OS treats them as keyboards,
   * so "connecting" means we start capturing their keyboard input.
   */
  async connect(deviceId: string): Promise<boolean> {
    try {
      this.connected = true;
      this.deviceId = deviceId;
      this.inputBuffer = '';

      this.logger.info(`Connected to QR hardware scanner: ${deviceId}`);
      return true;
    } catch (error) {
      this.logger.error({ message: 'Error connecting to QR hardware scanner' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Disconnect from the QR hardware scanner and clean up listeners.
   */
  async disconnect(): Promise<void> {
    try {
      if (this.keydownHandler && typeof window !== 'undefined') {
        window.removeEventListener('keydown', this.keydownHandler, true);
        this.keydownHandler = null;
      }
      this.connected = false;
      this.deviceId = null;
      this.inputBuffer = '';
      this.scanListeners.clear();
      this.logger.info('Disconnected from QR hardware scanner');
    } catch (error) {
      this.logger.error(
        { message: 'Error disconnecting from QR hardware scanner' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if connected to a QR hardware scanner.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Start listening for QR/barcode scans via DOM keydown HID events.
   * QR hardware scanners output rapid keystrokes terminated by Enter —
   * identical to USB HID barcode scanners.
   */
  startScanListener(callback: (data: string) => void): string {
    if (!this.connected) {
      this.logger.error('Cannot start scan listener: No QR hardware scanner connected');
      return '';
    }

    const subscriptionId = `qr-hw-${this.deviceId}-${Date.now()}`;
    this.scanListeners.set(subscriptionId, callback);

    if (!this.keydownHandler && typeof window !== 'undefined') {
      this.inputBuffer = '';
      this.lastKeyTime = 0;
      this.keydownHandler = (e: KeyboardEvent) => {
        const now = Date.now();
        if (now - this.lastKeyTime > SCAN_INTERVAL_MS && this.inputBuffer.length > 0) {
          this.inputBuffer = '';
        }
        this.lastKeyTime = now;
        if (e.key === 'Enter') {
          if (this.inputBuffer.length >= MIN_BARCODE_LENGTH) {
            const barcode = this.inputBuffer.trim();
            this.inputBuffer = '';
            this.scanListeners.forEach(cb => cb(barcode));
            this.logger.info(`QR hardware scanned: ${barcode}`);
          } else {
            this.inputBuffer = '';
          }
          return;
        }
        if (e.key.length === 1) {
          this.inputBuffer += e.key;
        }
      };
      window.addEventListener('keydown', this.keydownHandler, true);
      this.logger.info('DOM keydown HID listener attached for QR hardware scanner');
    }

    return subscriptionId;
  }

  /**
   * Stop listening for QR code scans.
   */
  stopScanListener(subscriptionId: string): void {
    this.scanListeners.delete(subscriptionId);
    if (this.scanListeners.size === 0 && this.keydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
      this.inputBuffer = '';
      this.logger.info('DOM keydown HID listener removed for QR hardware scanner');
    }
  }

  /**
   * Discover available QR hardware scanner devices.
   *
   * Implementation strategy:
   * 1. Electron: Query IPC for connected HID devices
   * 2. React Native: Use native module (if available)
   * 3. Fallback: Return known/configured devices from storage
   *
   * Note: Most USB QR scanners are HID keyboard devices, so they don't
   * require explicit enumeration. This method returns logical devices
   * that represent the HID input channel.
   */
  async discoverDevices(): Promise<Array<{ id: string; name: string }>> {
    try {
      // Strategy 1: Electron IPC
      if (typeof window !== 'undefined') {
        const electronAPI = (window as { electronAPI?: { scannerDiscover?: () => Promise<Array<{ id: string; name: string }>> } })
          .electronAPI;
        if (electronAPI?.scannerDiscover) {
          this.logger.info('Discovering QR hardware devices via Electron IPC');
          const devices = await electronAPI.scannerDiscover();
          if (devices && devices.length > 0) {
            this.logger.info(`Found ${devices.length} QR hardware devices via IPC`);
            return devices;
          }
        }
      }

      // Strategy 2: React Native native module
      const qrScannerModule = (global as { QRScannerModule?: { discoverDevices: () => Promise<Array<{ id: string; name: string }>> } })
        .QRScannerModule;
      if (qrScannerModule) {
        this.logger.info('Discovering QR hardware devices via React Native module');
        const devices = await qrScannerModule.discoverDevices();
        if (devices && devices.length > 0) {
          this.logger.info(`Found ${devices.length} QR hardware devices via native module`);
          return devices;
        }
      }

      // Strategy 3: Check for stored/configured devices
      const storedDevices = await this.getStoredDevices();
      if (storedDevices.length > 0) {
        this.logger.info(`Using ${storedDevices.length} stored QR hardware devices`);
        return storedDevices;
      }

      // Strategy 4: Return default HID device
      // Most USB QR scanners work as HID keyboards, so we return a logical device
      this.logger.info('No specific devices found, returning default HID QR scanner');
      return [
        {
          id: 'qr-hid-default',
          name: 'USB/Bluetooth HID QR Scanner',
        },
      ];
    } catch (error) {
      this.logger.error({ message: 'Error discovering QR hardware devices' }, error instanceof Error ? error : new Error(String(error)));

      // Return default device on error
      return [
        {
          id: 'qr-hid-default',
          name: 'USB/Bluetooth HID QR Scanner',
        },
      ];
    }
  }

  /**
   * Get stored/configured QR scanner devices from local storage.
   * This allows users to manually configure known devices.
   */
  private async getStoredDevices(): Promise<Array<{ id: string; name: string }>> {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('qr_hardware_devices');
        if (stored) {
          const devices = JSON.parse(stored);
          if (Array.isArray(devices)) {
            return devices;
          }
        }
      }
    } catch (error) {
      this.logger.error({ message: 'Error reading stored QR devices' }, error instanceof Error ? error : new Error(String(error)));
    }
    return [];
  }

  /**
   * Store a QR scanner device configuration for future discovery.
   * This allows users to manually add known devices.
   */
  async storeDevice(device: { id: string; name: string }): Promise<boolean> {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = await this.getStoredDevices();
        // Check if device already exists
        const exists = stored.some(d => d.id === device.id);
        if (!exists) {
          stored.push(device);
          localStorage.setItem('qr_hardware_devices', JSON.stringify(stored));
          this.logger.info(`Stored QR device: ${device.name} (${device.id})`);
          return true;
        }
      }
      return false;
    } catch (error) {
      this.logger.error({ message: 'Error storing QR device' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Remove a stored QR scanner device.
   */
  async removeStoredDevice(deviceId: string): Promise<boolean> {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = await this.getStoredDevices();
        const filtered = stored.filter(d => d.id !== deviceId);
        if (filtered.length < stored.length) {
          localStorage.setItem('qr_hardware_devices', JSON.stringify(filtered));
          this.logger.info(`Removed stored QR device: ${deviceId}`);
          return true;
        }
      }
      return false;
    } catch (error) {
      this.logger.error({ message: 'Error removing stored QR device' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Inject scan data programmatically — for testing or when the native layer
   * forwards a completed QR string from the hardware scanner.
   */
  emitScanData(data: string): void {
    if (this.connected) {
      this.scanListeners.forEach(callback => {
        callback(data);
      });
    }
  }
}
