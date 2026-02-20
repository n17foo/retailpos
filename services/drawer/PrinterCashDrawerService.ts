import { CashDrawerServiceInterface, DrawerDriverType } from './CashDrawerServiceInterface';
import { BasePrinterService } from '../printer/BasePrinterService';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Drawer driver that sends the ESC/POS drawer-kick command
 * through the receipt printer (the most common POS setup where
 * the drawer is connected to the printer via RJ-11).
 */
export class PrinterDrawerDriver implements CashDrawerServiceInterface {
  readonly driverType: DrawerDriverType = 'printer';
  private logger = LoggerFactory.getInstance().createLogger('CashDrawer');

  constructor(
    private printer: BasePrinterService,
    private pin: 2 | 5 = 2
  ) {}

  async open(): Promise<boolean> {
    if (!this.printer.isConnected()) {
      this.logger.warn('Cannot open drawer — printer not connected');
      return false;
    }

    try {
      const result = await this.printer.openDrawer(this.pin);
      if (result) {
        this.logger.info('Cash drawer opened via printer');
      }
      return result;
    } catch (error) {
      this.logger.error('Failed to open cash drawer', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async isOpen(): Promise<boolean | undefined> {
    try {
      const status = await this.printer.getStatus();
      return status.drawerOpen;
    } catch {
      return undefined;
    }
  }
}

/**
 * No-op driver used when no cash drawer is configured.
 * open() always returns true so the checkout flow can proceed.
 */
export class NoOpDrawerDriver implements CashDrawerServiceInterface {
  readonly driverType: DrawerDriverType = 'none';

  async open(): Promise<boolean> {
    return true;
  }

  async isOpen(): Promise<boolean | undefined> {
    return undefined;
  }
}
