import { LoggerFactory } from '../logger/LoggerFactory';
import { AbstractPrinterService, ESC_POS_COMMANDS } from './BasePrinterService';
import { PrinterConfig, PrinterStatus, ReceiptData } from './PrinterTypes';
import { receiptConfigService } from './ReceiptConfigService';
import { getElectronAPI, ElectronPrinterConfig } from '../../utils/electron';

/**
 * Electron-specific printer service.
 *
 * On desktop (Electron) the React Native printer SDK (`@tillpos/rn-receipt-printer-utils`)
 * is unavailable because it relies on native Android/iOS modules. Instead this service
 * delegates all I/O to the Electron main process via IPC methods exposed through
 * `window.electronAPI` (see `utils/electron.ts → ElectronAPI`).
 *
 * The Electron main process is expected to implement the actual communication with the
 * printer over TCP (network), USB, or Bluetooth using Node.js libraries such as:
 *  - `net` (for network printers on port 9100)
 *  - `usb` / `escpos` (for USB printers)
 *  - `@anthropic-ai/bluetooth-serial-port` or `noble` (for BT printers)
 */
export class ElectronPrinterService extends AbstractPrinterService {
  private logger = LoggerFactory.getInstance().createLogger('ElectronPrinterService');
  private printerConfig: ElectronPrinterConfig | null = null;

  /**
   * Connect to a printer.
   * Accepts the same shape as UnifiedPrinterService but routes through Electron IPC.
   */
  async connect(config: {
    printerType: string;
    printerName: string;
    host?: string;
    port?: number;
    vendorId?: string;
    productId?: string;
    macAddress?: string;
    deviceId?: string;
  }): Promise<boolean> {
    try {
      const api = getElectronAPI();
      if (!api) {
        this.logger.error('ElectronAPI not available — not running in Electron');
        return false;
      }

      this.printerConfig = {
        connectionType: config.printerType as 'network' | 'usb' | 'bluetooth',
        host: config.host,
        port: config.port,
        vendorId: config.vendorId,
        productId: config.productId,
        macAddress: config.macAddress,
      };

      // Verify the printer is reachable via IPC
      const status = await api.printerGetStatus(this.printerConfig);
      this._isConnected = status.isOnline;
      this._connectionConfig = config;

      if (this._isConnected) {
        this.logger.info(`Connected to ${config.printerType} printer: ${config.printerName}`);
      } else {
        this.logger.warn(`Printer ${config.printerName} is offline`);
      }

      return this._isConnected;
    } catch (error) {
      this.logger.error({ message: 'Failed to connect to Electron printer' }, error instanceof Error ? error : new Error(String(error)));
      this._isConnected = false;
      return false;
    }
  }

  /**
   * Send raw ESC/POS bytes to the printer via Electron IPC.
   * This powers openDrawer(), formatReceiptBuffer()-based printing, etc.
   */
  protected async sendBytes(data: Uint8Array): Promise<boolean> {
    if (!this._isConnected || !this.printerConfig) return false;

    try {
      const api = getElectronAPI();
      if (!api) return false;

      // Convert Uint8Array to base64 without Node.js Buffer (works in Electron renderer)
      const binary = Array.from(data)
        .map(b => String.fromCharCode(b))
        .join('');
      const base64 = btoa(binary);
      return await api.printerSendRawData(base64, this.printerConfig);
    } catch (error) {
      this.logger.error({ message: 'sendBytes failed' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Print a receipt by building ESC/POS buffer and sending raw bytes.
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    if (!this._isConnected) {
      throw new Error('Not connected to a printer');
    }

    try {
      this.logger.info(`Printing receipt for order ${data.orderId}`);
      const buffer = this.formatReceiptBuffer(data);

      // Optionally open drawer after print
      const config = receiptConfigService.getConfig();
      if (config.options.openCashDrawer) {
        const drawerCmd = new Uint8Array(ESC_POS_COMMANDS.DRAWER_KICK_PIN2);
        const combined = new Uint8Array(buffer.length + drawerCmd.length);
        combined.set(buffer);
        combined.set(drawerCmd, buffer.length);
        return await this.sendBytes(combined);
      }

      return await this.sendBytes(buffer);
    } catch (error) {
      this.logger.error({ message: 'Failed to print receipt' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get printer status via Electron IPC.
   */
  async getStatus(): Promise<PrinterStatus> {
    if (!this.printerConfig) {
      return { isOnline: false, hasPaper: false, errorMessage: 'No printer configured' };
    }

    try {
      const api = getElectronAPI();
      if (!api) {
        return { isOnline: false, hasPaper: false, errorMessage: 'ElectronAPI not available' };
      }

      const status = await api.printerGetStatus(this.printerConfig);
      this._isConnected = status.isOnline;
      return { isOnline: status.isOnline, hasPaper: status.hasPaper };
    } catch (error) {
      this.logger.error({ message: 'Failed to get printer status' }, error instanceof Error ? error : new Error(String(error)));
      return { isOnline: false, hasPaper: false, errorMessage: 'Failed to query status' };
    }
  }

  /**
   * Discover printers via Electron IPC (main process uses mDNS / USB enumeration).
   */
  async discoverPrinters(): Promise<PrinterConfig[]> {
    try {
      const api = getElectronAPI();
      if (!api?.printerDiscover) return [];
      const raw = await api.printerDiscover();
      return raw.map(
        (d: { name: string; connectionType: string; host?: string; port?: number; vendorId?: string; productId?: string }) =>
          ({
            printerName: d.name,
            connectionType: d.connectionType as 'network' | 'usb' | 'bluetooth',
            ipAddress: d.host,
            port: d.port,
            vendorId: d.vendorId ? parseInt(d.vendorId, 16) : undefined,
            productId: d.productId ? parseInt(d.productId, 16) : undefined,
          }) as PrinterConfig
      );
    } catch (error) {
      this.logger.error({ message: 'discoverPrinters failed' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Disconnect from the printer.
   */
  async disconnect(): Promise<void> {
    this.printerConfig = null;
    await super.disconnect();
    this.logger.info('Disconnected from Electron printer');
  }
}
