import { ScannerServiceInterface } from '../ScannerServiceInterface';
import { LoggerFactory } from '../../logger/loggerFactory';

/**
 * Mock implementation of the QR Hardware Scanner Service
 */
export class QRHardwareScannerMockService implements ScannerServiceInterface {
  private static instance: QRHardwareScannerMockService;
  private connected: boolean = false;
  private activeSubscriptions: Map<string, (data: string) => void> = new Map();
  private subscriptionCounter: number = 0;
  private connectedDeviceId: string | null = null;
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;

  private constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('QRHardwareScannerMockService');
  }

  public static getInstance(): QRHardwareScannerMockService {
    if (!QRHardwareScannerMockService.instance) {
      QRHardwareScannerMockService.instance = new QRHardwareScannerMockService();
    }
    return QRHardwareScannerMockService.instance;
  }

  /**
   * Connect to a mock QR hardware scanner
   */
  public async connect(deviceId: string): Promise<boolean> {
    this.logger.info(`Connecting to QR hardware scanner: ${deviceId}`);
    this.connected = true;
    this.connectedDeviceId = deviceId;
    return true;
  }

  /**
   * Disconnect from the mock QR hardware scanner
   */
  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from QR hardware scanner');
    this.connected = false;
    this.connectedDeviceId = null;
    this.activeSubscriptions.clear();
  }

  /**
   * Check if connected to the mock QR hardware scanner
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Start listening for QR code scans on the mock QR hardware scanner
   */
  public startScanListener(callback: (data: string) => void): string {
    this.logger.info('Starting QR hardware scanner listener');
    const subscriptionId = `mock-qr-hw-${this.subscriptionCounter++}`;
    this.activeSubscriptions.set(subscriptionId, callback);

    // Simulate a QR code scan after a short delay
    setTimeout(() => {
      if (this.connected && this.activeSubscriptions.has(subscriptionId)) {
        const mockQRData = `https://pay.example.com/txn/${Math.floor(Math.random() * 1000000)}`;
        this.logger.debug(`QR hardware scanner detected QR code: ${mockQRData}`);
        callback(mockQRData);
      }
    }, 1200);

    return subscriptionId;
  }

  /**
   * Stop listening for QR code scans on the mock QR hardware scanner
   */
  public stopScanListener(subscriptionId: string): void {
    this.logger.info(`Stopping QR hardware scanner listener: ${subscriptionId}`);
    this.activeSubscriptions.delete(subscriptionId);
  }

  /**
   * Discover available mock QR hardware scanner devices
   */
  public async discoverDevices(): Promise<Array<{ id: string; name: string }>> {
    this.logger.info('Discovering QR hardware scanner devices');
    return [
      { id: 'mock-qr-hw-1', name: 'Mock Zebra DS9308 QR Scanner' },
      { id: 'mock-qr-hw-2', name: 'Mock Honeywell YJ4600 QR Reader' },
    ];
  }
}
