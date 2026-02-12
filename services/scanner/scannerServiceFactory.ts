import { ScannerServiceInterface } from './ScannerServiceInterface';
import { CameraScannerMockService } from './mock/CameraScannerMockService';
import { BluetoothScannerMockService } from './mock/BluetoothScannerMockService';
import { USBScannerMockService } from './mock/USBScannerMockService';
import { CameraScannerService } from './CameraScannerService';
import { BluetoothScannerService } from './BluetoothScannerService';
import { USBScannerService } from './USBScannerService';
import { LoggerFactory } from '../logger/loggerFactory';
import { USE_MOCK_SCANNER } from '@env';

/**
 * Enum for scanner types supported by the application
 */
export enum ScannerType {
  CAMERA = 'camera',
  BLUETOOTH = 'bluetooth',
  USB = 'usb',
}

/**
 * Factory for creating and managing scanner services
 */
export class ScannerServiceFactory {
  private static instance: ScannerServiceFactory;
  private currentService: ScannerServiceInterface | null = null;
  private currentType: ScannerType | null = null;
  private logger = LoggerFactory.getInstance().createLogger('ScannerServiceFactory');

  private services: Map<ScannerType, ScannerServiceInterface> = new Map();

  private constructor() {
    this.initializeServices();
  }

  /**
   * Initialize scanner services based on the USE_MOCK_SCANNER flag
   */
  private initializeServices(): void {
    const useMock = USE_MOCK_SCANNER === 'true';
    this.logger.info(`Initializing scanner services (mock=${useMock})`);
    this.services.set(ScannerType.CAMERA, useMock ? CameraScannerMockService.getInstance() : new CameraScannerService());
    this.services.set(ScannerType.BLUETOOTH, useMock ? BluetoothScannerMockService.getInstance() : new BluetoothScannerService());
    this.services.set(ScannerType.USB, useMock ? USBScannerMockService.getInstance() : new USBScannerService());
  }

  /**
   * Get the singleton instance of the factory
   */
  public static getInstance(): ScannerServiceFactory {
    if (!ScannerServiceFactory.instance) {
      ScannerServiceFactory.instance = new ScannerServiceFactory();
    }
    return ScannerServiceFactory.instance;
  }

  /**
   * Get the scanner service for the specified type
   * @param type The scanner type to get service for
   * @returns Scanner service instance or null if not found
   */
  public getService(type: ScannerType): ScannerServiceInterface | null {
    const service = this.services.get(type);
    if (!service) {
      this.logger.error(`No scanner service found for type: ${type}`);
      return null;
    }

    this.currentService = service;
    this.currentType = type;
    return service;
  }

  /**
   * Get the current scanner service
   * @returns Current scanner service or null if not set or camera type
   */
  public getCurrentService(): ScannerServiceInterface | null {
    return this.currentService;
  }

  /**
   * Get the current scanner type
   * @returns Current scanner type or null if not set
   */
  public getCurrentType(): ScannerType | null {
    return this.currentType;
  }

  /**
   * Cleanup all scanner connections
   */
  public async disconnectAll(): Promise<void> {
    for (const service of this.services.values()) {
      await service.disconnect();
    }
  }
}
