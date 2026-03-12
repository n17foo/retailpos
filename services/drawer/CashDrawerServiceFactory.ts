import { CashDrawerServiceInterface, DrawerDriverType } from './CashDrawerServiceInterface';
import { PrinterDrawerDriver, NoOpDrawerDriver } from './PrinterCashDrawerService';
import { ElectronDrawerDriver } from './ElectronDrawerDriver';
import { PrinterServiceFactory } from '../printer/PrinterServiceFactory';
import { LoggerFactory } from '../logger/LoggerFactory';
import { isElectron } from '../../utils/electron';

/**
 * Factory for creating and managing the cash drawer service.
 *
 * Usage:
 *   const drawer = CashDrawerServiceFactory.getInstance().getService();
 *   await drawer.open();
 */
export class CashDrawerServiceFactory {
  private static instance: CashDrawerServiceFactory;
  private logger = LoggerFactory.getInstance().createLogger('CashDrawerServiceFactory');
  private currentService: CashDrawerServiceInterface | null = null;
  private currentDriverType: DrawerDriverType = 'none';

  private constructor() {}

  static getInstance(): CashDrawerServiceFactory {
    if (!CashDrawerServiceFactory.instance) {
      CashDrawerServiceFactory.instance = new CashDrawerServiceFactory();
    }
    return CashDrawerServiceFactory.instance;
  }

  /**
   * Get the active cash drawer service.
   *
   * The service is resolved in this priority order:
   *  1. If a printer is currently connected → PrinterDrawerDriver (RJ-11 kick via ESC/POS)
   *  2. Otherwise → NoOpDrawerDriver (no-op; open() always returns true so checkout can proceed)
   *
   * Call reset() after the printer connection changes to pick up the new state.
   */
  getService(): CashDrawerServiceInterface {
    if (this.currentService) {
      return this.currentService;
    }

    this.currentService = this.resolve();
    this.logger.info(`Cash drawer driver resolved: ${this.currentDriverType}`);
    return this.currentService;
  }

  /**
   * Force re-resolution of the drawer driver.
   * Call this after connecting/disconnecting a printer or changing drawer settings.
   */
  reset(): void {
    this.currentService = null;
    this.currentDriverType = 'none';
  }

  /**
   * Returns the driver type currently in use.
   */
  getDriverType(): DrawerDriverType {
    return this.currentDriverType;
  }

  private resolve(): CashDrawerServiceInterface {
    try {
      const printerFactory = PrinterServiceFactory.getInstance();

      if (printerFactory.isConnectedToPrinter()) {
        // Access the internal unified printer service via the factory's active printer
        // The factory exposes printReceipt/disconnect but the drawer needs the BasePrinterService
        // We use a protected accessor pattern: cast to access the internal service
        const internalService = (
          printerFactory as unknown as { activePrinterService: import('../printer/BasePrinterService').BasePrinterService | null }
        ).activePrinterService;

        if (internalService) {
          this.currentDriverType = 'printer';
          return new PrinterDrawerDriver(internalService);
        }
      }
    } catch (error) {
      this.logger.warn(
        'Could not resolve printer for drawer, falling back to NoOp',
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // On Electron, try the IPC drawer driver as a fallback
    if (isElectron()) {
      try {
        // Attempt to load last-known printer config for the drawer kick
        const printerFactory = PrinterServiceFactory.getInstance();
        const activePrinter = printerFactory.getActivePrinter();
        if (activePrinter) {
          this.currentDriverType = 'printer';
          return new ElectronDrawerDriver({
            connectionType: activePrinter.connectionType,
            host: activePrinter.ipAddress,
            port: activePrinter.port,
            vendorId: activePrinter.vendorId?.toString(),
            productId: activePrinter.productId?.toString(),
            macAddress: activePrinter.macAddress,
          });
        }
      } catch (error) {
        this.logger.warn(
          'Could not create Electron drawer driver, falling back to NoOp',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    this.currentDriverType = 'none';
    return new NoOpDrawerDriver();
  }
}

export const cashDrawerServiceFactory = CashDrawerServiceFactory.getInstance();
