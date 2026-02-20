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
export class QRHardwareScannerService implements ScannerServiceInterface {
  private connected: boolean = false;
  private deviceId: string | null = null;
  private scanListeners: Map<string, (data: string) => void> = new Map();
  private inputBuffer: string = '';
  private keyEventListener: unknown = null;
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
      if (this.keyEventListener) {
        this.keyEventListener = null;
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
   * Start listening for QR code scans from the connected hardware scanner.
   *
   * QR hardware scanners output data as rapid keyboard input terminated by
   * Enter/Return. This method registers a callback that fires when a complete
   * QR string is received (i.e. after the Enter key).
   */
  startScanListener(callback: (data: string) => void): string {
    if (!this.connected) {
      this.logger.error('Cannot start scan listener: No QR hardware scanner connected');
      return '';
    }

    try {
      const subscriptionId = `qr-hw-${this.deviceId}-${Date.now()}`;
      this.scanListeners.set(subscriptionId, callback);

      // In a real implementation, you would set up native event handlers to
      // capture HID keyboard input from the specific USB device.
      //
      // Example with a hypothetical native module:
      //
      // this.keyEventListener = DeviceEventEmitter.addListener(
      //   'QRHardwareScannerDataReceived',
      //   (event) => {
      //     if (event.deviceId === this.deviceId) {
      //       // Scanner sends complete string terminated by Enter
      //       this.scanListeners.forEach(cb => cb(event.data));
      //     }
      //   }
      // );

      this.logger.info('Started QR hardware scan listener');
      return subscriptionId;
    } catch (error) {
      this.logger.error({ message: 'Error starting QR hardware scan listener' }, error instanceof Error ? error : new Error(String(error)));
      return '';
    }
  }

  /**
   * Stop listening for QR code scans.
   */
  stopScanListener(subscriptionId: string): void {
    if (this.scanListeners.has(subscriptionId)) {
      this.scanListeners.delete(subscriptionId);
      this.logger.info(`Stopped QR hardware scan listener: ${subscriptionId}`);
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
