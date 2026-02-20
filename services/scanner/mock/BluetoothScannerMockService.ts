import { LoggerFactory } from '../../logger/LoggerFactory';
import { ScannerServiceInterface } from '../ScannerServiceInterface';

/**
 * Mock implementation of the Bluetooth Scanner Service
 */
export class BluetoothScannerMockService implements ScannerServiceInterface {
  private static instance: BluetoothScannerMockService;
  private connected: boolean = false;
  private activeSubscriptions: Map<string, (data: string) => void> = new Map();
  private subscriptionCounter: number = 0;
  private connectedDeviceId: string | null = null;
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;

  private constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('BluetoothScannerMockService');
  }

  public static getInstance(): BluetoothScannerMockService {
    if (!BluetoothScannerMockService.instance) {
      BluetoothScannerMockService.instance = new BluetoothScannerMockService();
    }
    return BluetoothScannerMockService.instance;
  }

  /**
   * Connect to a mock bluetooth scanner
   */
  public async connect(deviceId: string): Promise<boolean> {
    this.logger.info(`Connecting to bluetooth scanner: ${deviceId}`);
    this.connected = true;
    this.connectedDeviceId = deviceId;
    return true;
  }

  /**
   * Disconnect from the mock bluetooth scanner
   */
  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from bluetooth scanner');
    this.connected = false;
    this.connectedDeviceId = null;
    this.activeSubscriptions.clear();
  }

  /**
   * Check if connected to the mock bluetooth scanner
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Start listening for barcode scans on the mock bluetooth scanner
   */
  public startScanListener(callback: (data: string) => void): string {
    this.logger.info('Starting bluetooth scanner listener');
    const subscriptionId = `mock-bt-${this.subscriptionCounter++}`;
    this.activeSubscriptions.set(subscriptionId, callback);

    // Simulate a barcode scan after a short delay
    setTimeout(() => {
      if (this.connected && this.activeSubscriptions.has(subscriptionId)) {
        const mockBarcode = `MOCK-BT-${Math.floor(Math.random() * 1000000)}`;
        this.logger.debug(`Bluetooth scanner detected barcode: ${mockBarcode}`);
        callback(mockBarcode);
      }
    }, 2000);

    return subscriptionId;
  }

  /**
   * Stop listening for barcode scans on the mock bluetooth scanner
   */
  public stopScanListener(subscriptionId: string): void {
    this.logger.info(`Stopping bluetooth scanner listener: ${subscriptionId}`);
    this.activeSubscriptions.delete(subscriptionId);
  }

  /**
   * Discover available mock bluetooth scanner devices
   */
  public async discoverDevices(): Promise<Array<{ id: string; name: string }>> {
    this.logger.info('Discovering bluetooth scanner devices');
    return [
      { id: 'mock-bt-scanner-1', name: 'Mock Bluetooth Scanner 1' },
      { id: 'mock-bt-scanner-2', name: 'Mock Bluetooth Scanner 2' },
    ];
  }
}
