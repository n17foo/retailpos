import { AbstractPrinterService } from './BasePrinterService';
import { PrinterStatus, ReceiptData } from './PrinterTypes';

// We'll use dynamic imports for these native modules to avoid initialization issues
// These variables will hold the imported modules when needed
let USBPrinter: any = null;
let BLEPrinter: any = null;
let NetPrinter: any = null;

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
 * using the @tillpos/rn-receipt-printer-utils library
 */
export class UnifiedPrinterService extends AbstractPrinterService {
  private printerInstance: any = null;
  private printerType: PrinterConnectionType | null = null;

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

      console.log(`Connecting to ${config.printerType} printer: ${config.printerName}`);

      this.printerType = config.printerType;

      // Dynamically import the required printer modules
      try {
        if (!USBPrinter || !BLEPrinter || !NetPrinter) {
          console.log('Dynamically importing printer modules');
          const printerUtils = require('@tillpos/rn-receipt-printer-utils');
          USBPrinter = printerUtils.USBPrinter;
          BLEPrinter = printerUtils.BLEPrinter;
          NetPrinter = printerUtils.NetPrinter;
        }
      } catch (importError) {
        console.warn('Failed to import printer modules:', importError);
        throw new Error('Failed to initialize printer modules: ' + importError.message);
      }

      switch (config.printerType) {
        case PrinterConnectionType.USB: {
          const usbConfig = config as USBPrinterConfig;

          // Use USBPrinter methods directly (it's an object with static methods)
          this.printerInstance = USBPrinter;

          // For USB printers, we'll connect when sending data
          // Just store the connection info for later use
          this._isConnected = true;
          this._connectionConfig = usbConfig;

          return true;
        }

        case PrinterConnectionType.BLUETOOTH: {
          const bleConfig = config as BluetoothPrinterConfig;

          // Use BLEPrinter methods directly (it only has connectAndSend method)
          this.printerInstance = BLEPrinter;

          // Check if we have a valid MAC address for connection
          if (!bleConfig.macAddress) {
            console.error('MAC address is required for Bluetooth printer connection');
            return false;
          }

          // For BLEPrinter, we don't need to scan for devices
          // Just store the MAC address for later use in printing

          // Connect to the printer
          const connected = await this.printerInstance.connectPrinter(bleConfig.deviceId, bleConfig.macAddress);

          this._isConnected = connected;
          this._connectionConfig = bleConfig;

          return connected;
        }

        case PrinterConnectionType.NETWORK: {
          const netConfig = config as NetworkPrinterConfig;

          // Use NetPrinter methods directly (it's an object with static methods)
          this.printerInstance = NetPrinter;

          // For network printers, we don't actually connect until we send data
          // Just store the connection info for later use
          this._isConnected = true;
          this._connectionConfig = netConfig;

          return true;
        }

        default:
          throw new Error(`Unsupported printer type.`);
      }
    } catch (error) {
      // Safely access the printer type using a type guard
      const printerTypeName = config && 'printerType' in config ? String(config.printerType) : 'unknown';

      console.error(`Failed to connect to ${printerTypeName} printer:`, error);
      this._isConnected = false;
      this.printerInstance = null;
      return false;
    }
  }

  /**
   * Print receipt on the printer
   * @param data Receipt data
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    if (!this._isConnected || !this.printerInstance) {
      throw new Error('Not connected to a printer');
    }

    try {
      console.log(`Printing receipt for order ${data.orderId}`);

      // Initialize the printer
      await this.printerInstance.init();

      // Print centered header with bold text
      await this.printerInstance.alignCenter();
      await this.printerInstance.setBold(true);
      await this.printerInstance.printText('RetailPOS\n');
      await this.printerInstance.setBold(false);

      // Print store info
      await this.printerInstance.printText('123 Main Street\n');
      await this.printerInstance.printText('Anytown, CA 94538\n');
      await this.printerInstance.printText('Tel: (555) 123-4567\n');

      // Divider
      await this.printerInstance.alignLeft();
      await this.printerInstance.printText('--------------------------------\n');

      // Order info
      await this.printerInstance.printText(`Order #: ${data.orderId}\n`);
      await this.printerInstance.printText(`Date: ${data.date.toLocaleString()}\n`);
      await this.printerInstance.printText(`Cashier: ${data.cashierName}\n`);

      if (data.customerName) {
        await this.printerInstance.printText(`Customer: ${data.customerName}\n`);
      }

      // Divider
      await this.printerInstance.printText('--------------------------------\n');

      // Items header
      await this.printerInstance.printText('Item                 Qty    Price   Total\n');
      await this.printerInstance.printText('--------------------------------\n');

      // Order items
      for (const item of data.items) {
        const itemTotal = item.quantity * item.price;

        // Format item name to fit within 20 chars
        let itemName = item.name.substring(0, 17);
        if (item.name.length > 17) {
          itemName += '...';
        }

        // Pad name, quantity, price, and total
        const line = `${itemName.padEnd(20)}${item.quantity.toString().padStart(3)} ${item.price.toFixed(2).padStart(8)} ${itemTotal.toFixed(2).padStart(8)}`;
        await this.printerInstance.printText(`${line}\n`);
      }

      // Divider
      await this.printerInstance.printText('--------------------------------\n');

      // Totals
      await this.printerInstance.alignRight();
      await this.printerInstance.printText(`Subtotal: ${data.subtotal.toFixed(2)}\n`);
      await this.printerInstance.printText(`Tax: ${data.tax.toFixed(2)}\n`);

      // Total - bold
      await this.printerInstance.setBold(true);
      await this.printerInstance.printText(`Total: ${data.total.toFixed(2)}\n`);
      await this.printerInstance.setBold(false);

      // Divider
      await this.printerInstance.alignCenter();
      await this.printerInstance.printText('================================\n');

      // Payment method
      await this.printerInstance.alignLeft();
      await this.printerInstance.printText(`Payment Method: ${data.paymentMethod}\n\n`);

      // Footer
      await this.printerInstance.alignCenter();
      await this.printerInstance.printText('Thank you for your purchase!\n');
      await this.printerInstance.printText('Please come again\n\n');

      // Cut paper
      await this.printerInstance.cutPaper();

      console.log('Receipt printed successfully');
      return true;
    } catch (error) {
      console.error('Failed to print receipt:', error);
      return false;
    }
  }

  /**
   * Get printer status
   */
  async getStatus(): Promise<PrinterStatus> {
    if (!this._isConnected || !this.printerInstance) {
      return {
        isOnline: false,
        hasPaper: false,
        errorMessage: 'Printer not connected',
      };
    }

    try {
      // Check connection status
      // Note: The @tillpos/rn-receipt-printer-utils library doesn't provide a direct method
      // to check printer status, so we'll attempt a simple operation to verify connectivity

      // Use a type guard to safely access printerType property
      const config = this._connectionConfig as PrinterConfig;
      if (!config || !('printerType' in config)) {
        throw new Error('Invalid printer configuration');
      }

      switch (config.printerType) {
        case PrinterConnectionType.USB: {
          const usbConfig = config as USBPrinterConfig;
          const connected = await this.printerInstance.connectPrinter(usbConfig.vendorId, usbConfig.productId);

          if (connected) {
            return {
              isOnline: true,
              hasPaper: true, // Cannot determine paper status with this library
              drawerOpen: false,
            };
          }
          break;
        }

        case PrinterConnectionType.BLUETOOTH: {
          const bleConfig = config as BluetoothPrinterConfig;
          const connected = await this.printerInstance.connectPrinter(bleConfig.deviceId, bleConfig.macAddress);

          if (connected) {
            return {
              isOnline: true,
              hasPaper: true,
              drawerOpen: false,
            };
          }
          break;
        }

        case PrinterConnectionType.NETWORK: {
          const netConfig = config as NetworkPrinterConfig;
          const connected = await this.printerInstance.connectPrinter(netConfig.host, netConfig.port);

          if (connected) {
            return {
              isOnline: true,
              hasPaper: true,
              drawerOpen: false,
            };
          }
          break;
        }
      }

      // If we reach here, connection check failed
      this._isConnected = false;
      return {
        isOnline: false,
        hasPaper: false,
        errorMessage: 'Printer connection lost',
      };
    } catch (error) {
      console.error('Failed to get printer status:', error);
      return {
        isOnline: false,
        hasPaper: false,
        errorMessage: 'Failed to get printer status',
      };
    }
  }

  /**
   * Disconnect from the printer
   */
  async disconnect(): Promise<void> {
    if (this._isConnected && this.printerInstance) {
      try {
        // Close the printer connection
        await this.printerInstance.closeConn();
        this.printerInstance = null;
        this.printerType = null;
      } catch (error) {
        console.error('Error disconnecting from printer:', error);
      }
    }

    await super.disconnect();
    console.log('Disconnected from printer');
  }
}
