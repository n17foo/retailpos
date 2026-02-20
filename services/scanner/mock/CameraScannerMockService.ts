import { LoggerFactory } from '../../logger/LoggerFactory';
import { ScannerServiceInterface } from '../ScannerServiceInterface';

/**
 * Mock implementation of the Camera Scanner Service
 */
export class CameraScannerMockService implements ScannerServiceInterface {
  private static instance: CameraScannerMockService;
  private connected: boolean = false;
  private activeSubscriptions: Map<string, (data: string) => void> = new Map();
  private subscriptionCounter: number = 0;
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;

  private constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('CameraScannerMockService');
  }

  public static getInstance(): CameraScannerMockService {
    if (!CameraScannerMockService.instance) {
      CameraScannerMockService.instance = new CameraScannerMockService();
    }
    return CameraScannerMockService.instance;
  }

  /**
   * Connect to a mock camera scanner
   */
  public async connect(deviceId: string): Promise<boolean> {
    this.logger.info(`Connecting to camera scanner: ${deviceId}`);
    this.connected = true;
    return true;
  }

  /**
   * Disconnect from the mock camera scanner
   */
  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from camera scanner');
    this.connected = false;
    this.activeSubscriptions.clear();
  }

  /**
   * Check if connected to the mock camera scanner
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Start listening for barcode scans on the mock camera scanner
   */
  public startScanListener(callback: (data: string) => void): string {
    this.logger.info('Starting camera scanner listener');
    const subscriptionId = `mock-cam-${this.subscriptionCounter++}`;
    this.activeSubscriptions.set(subscriptionId, callback);

    // Simulate a barcode scan after a short delay
    setTimeout(() => {
      if (this.connected && this.activeSubscriptions.has(subscriptionId)) {
        const mockBarcode = `MOCK-CAM-${Math.floor(Math.random() * 1000000)}`;
        this.logger.debug(`Camera scanner detected barcode: ${mockBarcode}`);
        callback(mockBarcode);
      }
    }, 1500);

    return subscriptionId;
  }

  /**
   * Stop listening for barcode scans on the mock camera scanner
   */
  public stopScanListener(subscriptionId: string): void {
    this.logger.info(`Stopping camera scanner listener: ${subscriptionId}`);
    this.activeSubscriptions.delete(subscriptionId);
  }

  /**
   * Discover available mock camera scanner devices
   */
  public async discoverDevices(): Promise<Array<{ id: string; name: string }>> {
    this.logger.info('Discovering camera scanner devices');
    return [{ id: 'mock-camera-1', name: 'Mock Built-in Camera' }];
  }
}
