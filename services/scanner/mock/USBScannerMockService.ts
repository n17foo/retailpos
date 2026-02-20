import { ScannerServiceInterface } from '../ScannerServiceInterface';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * Mock implementation of the USB Scanner Service
 */
export class USBScannerMockService implements ScannerServiceInterface {
  private static instance: USBScannerMockService;
  private connected: boolean = false;
  private activeSubscriptions: Map<string, (data: string) => void> = new Map();
  private subscriptionCounter: number = 0;
  private connectedDeviceId: string | null = null;
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;

  private constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('USBScannerMockService');
  }

  public static getInstance(): USBScannerMockService {
    if (!USBScannerMockService.instance) {
      USBScannerMockService.instance = new USBScannerMockService();
    }
    return USBScannerMockService.instance;
  }

  /**
   * Connect to a mock USB scanner
   */
  public async connect(deviceId: string): Promise<boolean> {
    this.logger.info(`Connecting to USB scanner: ${deviceId}`);
    this.connected = true;
    this.connectedDeviceId = deviceId;
    return true;
  }

  /**
   * Disconnect from the mock USB scanner
   */
  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from USB scanner');
    this.connected = false;
    this.connectedDeviceId = null;
    this.activeSubscriptions.clear();
  }

  /**
   * Check if connected to the mock USB scanner
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Start listening for barcode scans on the mock USB scanner
   */
  public startScanListener(callback: (data: string) => void): string {
    this.logger.info('Starting USB scanner listener');
    const subscriptionId = `mock-usb-${this.subscriptionCounter++}`;
    this.activeSubscriptions.set(subscriptionId, callback);

    // Simulate a barcode scan after a short delay
    setTimeout(() => {
      if (this.connected && this.activeSubscriptions.has(subscriptionId)) {
        const mockBarcode = `MOCK-USB-${Math.floor(Math.random() * 1000000)}`;
        this.logger.debug(`USB scanner detected barcode: ${mockBarcode}`);
        callback(mockBarcode);
      }
    }, 1000);

    return subscriptionId;
  }

  /**
   * Stop listening for barcode scans on the mock USB scanner
   */
  public stopScanListener(subscriptionId: string): void {
    this.logger.info(`Stopping USB scanner listener: ${subscriptionId}`);
    this.activeSubscriptions.delete(subscriptionId);
  }

  /**
   * Discover available mock USB scanner devices
   */
  public async discoverDevices(): Promise<Array<{ id: string; name: string }>> {
    this.logger.info('Discovering USB scanner devices');
    return [
      { id: 'mock-usb-scanner-1', name: 'Mock USB Scanner 1' },
      { id: 'mock-usb-scanner-2', name: 'Mock USB Scanner 2' },
      { id: 'mock-usb-scanner-3', name: 'Mock USB Scanner 3' },
    ];
  }
}
