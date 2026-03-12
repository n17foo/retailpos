import { ScannerServiceInterface } from './ScannerServiceInterface';
import { CameraScannerMockService } from './mock/CameraScannerMockService';
import { BluetoothScannerMockService } from './mock/BluetoothScannerMockService';
import { USBScannerMockService } from './mock/USBScannerMockService';
import { CameraScannerService } from './CameraScannerService';
import { BluetoothScannerService } from './BluetoothScannerService';
import { USBScannerService } from './USBScannerService';
import { QRHardwareScannerService } from './QRHardwareScannerService';
import { QRHardwareScannerMockService } from './mock/QRHardwareScannerMockService';
import { ElectronScannerService } from './ElectronScannerService';
import { LoggerFactory } from '../logger/LoggerFactory';
import { isElectron } from '../../utils/electron';
import { USE_MOCK_SCANNER } from '@env';

/**
 * Enum for scanner types supported by the application
 */
export enum ScannerType {
  CAMERA = 'camera',
  BLUETOOTH = 'bluetooth',
  USB = 'usb',
  QR_HARDWARE = 'qr_hardware',
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
    const runningInElectron = isElectron();
    this.logger.info(`Initializing scanner services (mock=${useMock}, electron=${runningInElectron})`);

    if (useMock) {
      this.services.set(ScannerType.CAMERA, CameraScannerMockService.getInstance());
      this.services.set(ScannerType.BLUETOOTH, BluetoothScannerMockService.getInstance());
      this.services.set(ScannerType.USB, USBScannerMockService.getInstance());
      this.services.set(ScannerType.QR_HARDWARE, QRHardwareScannerMockService.getInstance());
      return;
    }

    if (runningInElectron) {
      // On Electron desktop:
      //  - Camera: not available (no expo-camera) → use mock as placeholder
      //  - Bluetooth BLE: react-native-ble-plx is mobile-only → use mock as placeholder
      //  - USB + QR Hardware: use ElectronScannerService (DOM keydown + IPC HID listener)
      const electronScanner = new ElectronScannerService();
      this.services.set(ScannerType.CAMERA, CameraScannerMockService.getInstance());
      this.services.set(ScannerType.BLUETOOTH, BluetoothScannerMockService.getInstance());
      this.services.set(ScannerType.USB, electronScanner);
      this.services.set(ScannerType.QR_HARDWARE, electronScanner);
    } else {
      // Mobile / Tablet — use native services
      this.services.set(ScannerType.CAMERA, new CameraScannerService());
      this.services.set(ScannerType.BLUETOOTH, new BluetoothScannerService());
      this.services.set(ScannerType.USB, new USBScannerService());
      this.services.set(ScannerType.QR_HARDWARE, new QRHardwareScannerService());
    }
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
