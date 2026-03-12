import { LoggerFactory } from '../logger/LoggerFactory';
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
   * In production this would enumerate USB HID devices filtered by known
   * QR scanner vendor IDs (e.g. Zebra, Honeywell, Datalogic, Newland).
   */
  async discoverDevices(): Promise<Array<{ id: string; name: string }>> {
    // Real implementation would use a native module to enumerate USB HID devices:
    //
    // try {
    //   const usbDevices = await USBModule.getConnectedDevices();
    //   return usbDevices
    //     .filter(device => QR_SCANNER_VENDOR_IDS.includes(device.vendorId))
    //     .map(device => ({
    //       id: `${device.vendorId}-${device.productId}`,
    //       name: device.productName || `QR Scanner (${device.vendorId}:${device.productId})`
    //     }));
    // } catch (error) {
    //   this.logger.error('Error discovering QR hardware devices:', error);
    //   return [];
    // }

    // Placeholder — returns mock data until native module is wired
    return [
      { id: 'qr-hw-1', name: 'Zebra DS9308 QR Scanner' },
      { id: 'qr-hw-2', name: 'Honeywell Youjie YJ4600 QR Reader' },
      { id: 'qr-hw-3', name: 'Newland FR80 Desktop QR Scanner' },
    ];
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
