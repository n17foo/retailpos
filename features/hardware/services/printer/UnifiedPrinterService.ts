import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { AbstractPrinterService } from './BasePrinterService';
import { PrinterStatus, ReceiptData } from './PrinterTypes';
import { receiptConfigService } from './ReceiptConfigService';

/**
 * Minimal typed surface of react-native-esc-pos-printer used by this service.
 * The module is loaded lazily — its constants resolve through the native
 * module at import time, so requiring it unconditionally breaks Jest/web.
 */
interface EscPosStatusEntry {
  status: string;
  message: string;
  statusCode: number;
}

interface EscPosPrinterStatus {
  online?: EscPosStatusEntry;
  paper?: EscPosStatusEntry;
  drawer?: EscPosStatusEntry;
}

interface EscPosPrinterInstance {
  addQueueTask<T>(task: () => Promise<T>): Promise<T | void>;
  connect(timeout?: number): Promise<unknown>;
  disconnect(): Promise<unknown>;
  getStatus(): Promise<EscPosPrinterStatus>;
  addText(text: string): Promise<unknown>;
  addFeedLine(lines?: number): Promise<unknown>;
  addTextAlign(param?: number): Promise<unknown>;
  addTextStyle(params?: { em?: number }): Promise<unknown>;
  addCut(type?: number): Promise<unknown>;
  addCommand(data: Uint8Array): Promise<unknown>;
  sendData(timeout?: number): Promise<unknown>;
}

interface EscPosPrinterModule {
  Printer: new (params: { target: string; deviceName: string }) => EscPosPrinterInstance;
  TextAlignType: { ALIGN_LEFT: number; ALIGN_CENTER: number; ALIGN_RIGHT: number };
  CommonParams: { TRUE: number; FALSE: number };
  PrinterPaperStatus: { PAPER_EMPTY: number };
  PrinterDrawerStatus: { DRAWER_HIGH: number };
}

const CONNECT_TIMEOUT_MS = 10000;
// Epson ePOS LAN printing is fixed at port 9100 — the SDK's TCP target
// string cannot express a custom port.
const EPOS_DEFAULT_PORT = 9100;

/**
 * Printer connection types supported by the unified printer service
 */
export enum PrinterConnectionType {
  USB = 'usb',
  BLUETOOTH = 'bluetooth',
  NETWORK = 'network',
}

/**
 * Base printer configuration
 */
export interface BasePrinterConfig {
  printerName: string;
  printerType: PrinterConnectionType;
  paperWidth?: number;
}

/**
 * USB printer configuration
 */
export interface USBPrinterConfig extends BasePrinterConfig {
  printerType: PrinterConnectionType.USB;
  vendorId: string;
  productId: string;
}

/**
 * Bluetooth printer configuration
 */
export interface BluetoothPrinterConfig extends BasePrinterConfig {
  printerType: PrinterConnectionType.BLUETOOTH;
  deviceId: string;
  macAddress: string;
}

/**
 * Network printer configuration
 */
export interface NetworkPrinterConfig extends BasePrinterConfig {
  printerType: PrinterConnectionType.NETWORK;
  host: string;
  port: number;
}

/**
 * Unified printer configuration type
 */
export type PrinterConfig = USBPrinterConfig | BluetoothPrinterConfig | NetworkPrinterConfig;

/**
 * Unified printer service that supports USB, Bluetooth, and Network printers
 * using the react-native-esc-pos-printer library (Epson ePOS SDK — works with
 * Epson TM printers and most ESC/POS compatibles over LAN/BT/USB).
 */
export class UnifiedPrinterService extends AbstractPrinterService {
  private printer: EscPosPrinterInstance | null = null;
  private printerType: PrinterConnectionType | null = null;
  private logger = LoggerFactory.getInstance().createLogger('UnifiedPrinterService');

  private loadModule(): EscPosPrinterModule {
    try {
      return require('react-native-esc-pos-printer') as EscPosPrinterModule;
    } catch (importError) {
      this.logger.warn('Failed to import esc-pos-printer module:', importError);
      throw new Error(
        'Failed to initialize printer modules: ' + (importError instanceof Error ? importError.message : String(importError)),
        { cause: importError }
      );
    }
  }

  /**
   * Map a PrinterConfig to an ePOS target string.
   * TCP:<ip> for LAN, BT:<mac> for Bluetooth, USB:<id> for USB.
   */
  private buildTarget(config: PrinterConfig): string {
    switch (config.printerType) {
      case PrinterConnectionType.USB: {
        const usbConfig = config as USBPrinterConfig;
        return `USB:${usbConfig.productId || usbConfig.vendorId}`;
      }
      case PrinterConnectionType.BLUETOOTH:
        return `BT:${(config as BluetoothPrinterConfig).macAddress}`;
      case PrinterConnectionType.NETWORK:
        return `TCP:${(config as NetworkPrinterConfig).host}`;
    }
  }

  /**
   * Connect to a printer
   * @param config Printer configuration
   */
  async connect(config: PrinterConfig): Promise<boolean> {
    try {
      // Ensure config has the expected properties with a type guard
      if (!config || !('printerType' in config) || !('printerName' in config)) {
        throw new Error('Invalid printer configuration');
      }

      this.logger.info(`Connecting to ${config.printerType} printer: ${config.printerName}`);

      const escPos = this.loadModule();

      if (config.printerType === PrinterConnectionType.BLUETOOTH && !(config as BluetoothPrinterConfig).macAddress) {
        this.logger.error('MAC address is required for Bluetooth printer connection');
        return false;
      }
      if (config.printerType === PrinterConnectionType.NETWORK && (config as NetworkPrinterConfig).port !== EPOS_DEFAULT_PORT) {
        this.logger.warn(
          `Network printer port ${(config as NetworkPrinterConfig).port} ignored — ePOS LAN printing uses port ${EPOS_DEFAULT_PORT}`
        );
      }

      const printer = new escPos.Printer({
        target: this.buildTarget(config),
        deviceName: config.printerName,
      });

      await printer.connect(CONNECT_TIMEOUT_MS);

      this.printer = printer;
      this.printerType = config.printerType;
      this._isConnected = true;
      this._connectionConfig = config;

      return true;
    } catch (error) {
      // Safely access the printer type using a type guard
      const printerTypeName = config && 'printerType' in config ? String(config.printerType) : 'unknown';

      this.logger.error(`Failed to connect to ${printerTypeName} printer:`, error instanceof Error ? error : new Error(String(error)));
      this._isConnected = false;
      this.printer = null;
      return false;
    }
  }

  /**
   * Print receipt on the printer
   * @param data Receipt data
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    if (!this._isConnected || !this.printer) {
      throw new Error('Not connected to a printer');
    }

    const printer = this.printer;
    const escPos = this.loadModule();
    const { ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT } = escPos.TextAlignType;
    const { TRUE, FALSE } = escPos.CommonParams;

    try {
      this.logger.info(`Printing receipt for order ${data.orderId}`);

      const config = receiptConfigService.getConfig();
      const cs = data.currencySymbol || '£';
      const divider = receiptConfigService.getDividerLine();
      const doubleDivider = receiptConfigService.getDoubleDividerLine();

      await printer.addQueueTask(async () => {
        const print = (text: string) => printer.addText(text);

        // Header — driven by ReceiptConfigService
        await printer.addTextAlign(ALIGN_CENTER);
        await printer.addTextStyle({ em: TRUE });
        await print(`${config.header.businessName}\n`);
        await printer.addTextStyle({ em: FALSE });

        if (config.header.addressLine1) {
          await print(`${config.header.addressLine1}\n`);
        }
        if (config.header.addressLine2) {
          await print(`${config.header.addressLine2}\n`);
        }
        if (config.header.phone) {
          await print(`Tel: ${config.header.phone}\n`);
        }
        if (config.header.taxId) {
          await print(`Tax ID: ${config.header.taxId}\n`);
        }

        // Divider
        await printer.addTextAlign(ALIGN_LEFT);
        await print(`${divider}\n`);

        // Order info
        await print(`Order #: ${data.orderId}\n`);
        await print(`Date: ${data.date.toLocaleString()}\n`);
        await print(`Cashier: ${data.cashierName}\n`);

        if (data.saleMode) {
          await print(`Mode: ${data.saleMode}\n`);
        }

        if (data.customerName) {
          await print(`Customer: ${data.customerName}\n`);
        }

        // Divider
        await print(`${divider}\n`);

        // Items
        for (const item of data.items) {
          const itemTotal = item.quantity * item.price;
          if (item.quantity > 1) {
            await print(`${item.name}\n`);
            await print(
              `${receiptConfigService.formatLine(`  ${item.quantity} x ${cs}${item.price.toFixed(2)}`, `${cs}${itemTotal.toFixed(2)}`)}\n`
            );
          } else {
            await print(`${receiptConfigService.formatLine(item.name, `${cs}${itemTotal.toFixed(2)}`)}\n`);
          }
        }

        // Divider
        await print(`${divider}\n`);

        // Totals
        await printer.addTextAlign(ALIGN_RIGHT);
        await print(`Subtotal: ${cs}${data.subtotal.toFixed(2)}\n`);
        await print(`Tax: ${cs}${data.tax.toFixed(2)}\n`);

        // Total — bold
        await printer.addTextStyle({ em: TRUE });
        await print(`${doubleDivider}\n`);
        await print(`Total: ${cs}${data.total.toFixed(2)}\n`);
        await printer.addTextStyle({ em: FALSE });
        await print(`${doubleDivider}\n`);

        // Payment method
        await printer.addTextAlign(ALIGN_LEFT);

        // Split tender: show payment breakdown
        if (data.paymentMethod === 'split' && data.paymentLines && data.paymentLines.length > 0) {
          await print(`Payment Method: Split Tender\n`);
          await print(`${divider}\n`);
          for (const line of data.paymentLines) {
            let methodLabel = line.method;
            if (line.method === 'card' || line.method === 'card_terminal') {
              methodLabel = line.cardBrand ? `${line.cardBrand} ····${line.last4}` : 'Card';
            } else if (line.method === 'cash') {
              methodLabel = 'Cash';
            } else if (line.method === 'store_credit') {
              methodLabel = 'Store Credit';
            } else if (line.method === 'loyalty') {
              methodLabel = 'Loyalty Points';
            }
            await print(`${receiptConfigService.formatLine(methodLabel, `${cs}${line.amount.toFixed(2)}`)}\n`);
          }
          await print(`${divider}\n\n`);
        } else {
          // Single payment method
          await print(`Payment Method: ${data.paymentMethod}\n\n`);
        }

        // Footer — driven by ReceiptConfigService
        await printer.addTextAlign(ALIGN_CENTER);
        if (config.footer.line1) {
          await print(`${config.footer.line1}\n`);
        }
        if (config.footer.line2) {
          await print(`${config.footer.line2}\n`);
        }
        if (config.footer.line3) {
          await print(`${config.footer.line3}\n`);
        }
        await printer.addFeedLine(2);

        // Cut paper (if supported)
        if (config.options.cutPaper) {
          await printer.addCut();
        }

        await printer.sendData();
      });

      this.logger.info('Receipt printed successfully');
      return true;
    } catch (error) {
      this.logger.error({ message: 'Failed to print receipt' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get printer status
   */
  async getStatus(): Promise<PrinterStatus> {
    if (!this._isConnected || !this.printer) {
      return {
        isOnline: false,
        hasPaper: false,
        errorMessage: 'Printer not connected',
      };
    }

    try {
      const escPos = this.loadModule();
      const status = await this.printer.getStatus();
      const online = status.online?.statusCode === escPos.CommonParams.TRUE;

      if (online) {
        return {
          isOnline: true,
          hasPaper: status.paper ? status.paper.statusCode !== escPos.PrinterPaperStatus.PAPER_EMPTY : true,
          drawerOpen: status.drawer?.statusCode === escPos.PrinterDrawerStatus.DRAWER_HIGH,
        };
      }

      this._isConnected = false;
      return {
        isOnline: false,
        hasPaper: false,
        errorMessage: 'Printer connection lost',
      };
    } catch (error) {
      this.logger.error('Failed to get printer status:', error instanceof Error ? error : new Error(String(error)));
      return {
        isOnline: false,
        hasPaper: false,
        errorMessage: 'Failed to get printer status',
      };
    }
  }

  /**
   * Override sendBytes to dispatch raw ESC/POS bytes through the active printer SDK.
   * This powers openDrawer() and any caller using formatReceiptBuffer().
   */
  protected async sendBytes(data: Uint8Array): Promise<boolean> {
    if (!this._isConnected || !this.printer) return false;

    const printer = this.printer;

    try {
      await printer.addQueueTask(async () => {
        await printer.addCommand(data);
        await printer.sendData();
      });
      return true;
    } catch (error) {
      this.logger.error({ message: 'sendBytes failed' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Disconnect from the printer
   */
  async disconnect(): Promise<void> {
    if (this._isConnected && this.printer) {
      try {
        await this.printer.disconnect();
        this.printer = null;
        this.printerType = null;
      } catch (error) {
        this.logger.error('Error disconnecting from printer:', error instanceof Error ? error : new Error(String(error)));
      }
    }

    await super.disconnect();
    this.logger.info('Disconnected from printer');
  }
}
