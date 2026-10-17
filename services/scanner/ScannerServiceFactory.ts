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

  // ── Shared sale connection ─────────────────────────────────────────────
  //
  // The sale screen holds one ref-counted connection to every HID-class
  // scanner (USB, QR hardware) for the lifetime of the screen. Scans are
  // fanned out to all registered callbacks; the underlying device is
  // connected once and only disconnected when the last consumer releases.

  private saleRefCount = 0;
  private saleCallbackSeq = 0;
  private saleCallbacks: Map<string, (code: string) => void> = new Map();
  private saleSubscriptionIds: Map<ScannerServiceInterface, string> = new Map();
  private saleConnectPromise: Promise<void> | null = null;

  /**
   * Register a scan callback on the shared sale connection.
   * Returns a release function — the hardware stays connected until the last
   * release call, so scans arriving while a modal/sheet is open are not lost.
   */
  public async connectForSale(onScan: (code: string) => void): Promise<() => void> {
    const id = `sale-${++this.saleCallbackSeq}`;
    this.saleCallbacks.set(id, onScan);
    this.saleRefCount += 1;

    if (!this.saleConnectPromise) {
      this.saleConnectPromise = this.establishSaleConnection();
    }
    await this.saleConnectPromise;

    return () => {
      this.saleCallbacks.delete(id);
      this.saleRefCount = Math.max(0, this.saleRefCount - 1);
      if (this.saleRefCount === 0) {
        void this.teardownSaleConnection();
      }
    };
  }

  private async establishSaleConnection(): Promise<void> {
    // USB and QR-hardware services are both HID keyboard scanners — on Electron
    // they share one service instance, deduplicated here.
    const services = new Set<ScannerServiceInterface>();
    for (const type of [ScannerType.USB, ScannerType.QR_HARDWARE]) {
      const service = this.services.get(type);
      if (service) services.add(service);
    }

    for (const service of services) {
      try {
        const connected = service.isConnected() || (await service.connect('sale-hid'));
        if (connected) {
          const subId = service.startScanListener(code => {
            this.saleCallbacks.forEach(cb => cb(code));
          });
          if (subId) this.saleSubscriptionIds.set(service, subId);
        }
      } catch (error) {
        this.logger.error({ message: 'Failed to connect scanner for sale' }, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private async teardownSaleConnection(): Promise<void> {
    this.saleConnectPromise = null;
    for (const [service, subId] of this.saleSubscriptionIds) {
      try {
        service.stopScanListener(subId);
        await service.disconnect();
      } catch (error) {
        this.logger.error({ message: 'Failed to release sale scanner' }, error instanceof Error ? error : new Error(String(error)));
      }
    }
    this.saleSubscriptionIds.clear();
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
