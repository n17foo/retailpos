import { CashDrawerServiceInterface, DrawerDriverType } from './CashDrawerServiceInterface';
import { LoggerFactory } from '../logger/LoggerFactory';
import { getElectronAPI, ElectronPrinterConfig } from '../../utils/electron';

/**
 * Electron-specific cash drawer driver.
 *
 * Sends drawer open/status commands directly via Electron IPC, bypassing the
 * printer service. This is useful when:
 *  - The drawer is connected to a printer but the printer service isn't active
 *  - The Electron main process manages the drawer through a dedicated USB driver
 *
 * Falls back to NoOp behaviour if the ElectronAPI is unavailable.
 */
export class ElectronDrawerDriver implements CashDrawerServiceInterface {
  readonly driverType: DrawerDriverType = 'printer';
  private logger = LoggerFactory.getInstance().createLogger('ElectronDrawerDriver');
  private printerConfig: ElectronPrinterConfig;
  private pin: 2 | 5;

  constructor(printerConfig: ElectronPrinterConfig, pin: 2 | 5 = 2) {
    this.printerConfig = printerConfig;
    this.pin = pin;
  }

  async open(): Promise<boolean> {
    const api = getElectronAPI();
    if (!api) {
      this.logger.warn('ElectronAPI not available — cannot open drawer');
      return false;
    }

    try {
      this.logger.info('Opening cash drawer via Electron IPC');
      return await api.drawerOpen(this.printerConfig, this.pin);
    } catch (error) {
      this.logger.error({ message: 'Failed to open drawer' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async isOpen(): Promise<boolean | undefined> {
    const api = getElectronAPI();
    if (!api) return undefined;

    try {
      return await api.drawerIsOpen(this.printerConfig);
    } catch (error) {
      this.logger.error({ message: 'Failed to check drawer status' }, error instanceof Error ? error : new Error(String(error)));
      return undefined;
    }
  }
}
