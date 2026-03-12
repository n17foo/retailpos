import { ReceiptData, PrinterStatus } from './PrinterTypes';
import { receiptConfigService } from './ReceiptConfigService';

/**
 * ESC/POS Command constants for Epson printers
 * These are the actual byte sequences for printer control
 */
export const ESC_POS_COMMANDS = {
  INIT: [0x1b, 0x40], // Initialize printer
  CUT: [0x1d, 0x56, 0x41, 0x10], // Full cut with feed
  DRAWER_KICK_PIN2: [0x1b, 0x70, 0x00, 0x19, 0xfa], // Open cash drawer (pin 2)
  DRAWER_KICK_PIN5: [0x1b, 0x70, 0x01, 0x19, 0xfa], // Open cash drawer (pin 5)
  FEED: [0x1b, 0x64, 0x10], // Feed paper 16 lines
  ALIGN_CENTER: [0x1b, 0x61, 0x01], // Center align
  ALIGN_LEFT: [0x1b, 0x61, 0x00], // Left align
  ALIGN_RIGHT: [0x1b, 0x61, 0x02], // Right align
  BOLD_ON: [0x1b, 0x45, 0x01], // Bold text on
  BOLD_OFF: [0x1b, 0x45, 0x00], // Bold text off
  DOUBLE_HEIGHT: [0x1b, 0x21, 0x10], // Double height text
  NORMAL_SIZE: [0x1b, 0x21, 0x00], // Normal text size
  FONT_A: [0x1b, 0x4d, 0x00], // Font A (default)
  FONT_B: [0x1b, 0x4d, 0x01], // Font B (smaller)
  NEWLINE: [0x0a], // Line feed
};

// Helper function to convert string to byte array (React Native compatible)
export function stringToBytes(text: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(text));
}

/**
 * Base Printer Service interface that all printer services must implement
 */
export interface BasePrinterService {
  /**
   * Connect to a printer
   * @param connectionConfig Connection configuration specific to the printer type
   */
  connect(connectionConfig: unknown): Promise<boolean>;

  /**
   * Print a receipt
   * @param data Receipt data to print
   */
  printReceipt(data: ReceiptData): Promise<boolean>;

  /**
   * Disconnect from the printer
   */
  disconnect(): Promise<void>;

  /**
   * Check if connected to printer
   */
  isConnected(): boolean;

  /**
   * Get printer status
   */
  getStatus(): Promise<PrinterStatus>;

  /**
   * Format receipt data into ESC/POS command buffer
   * @param data Receipt data
   */
  formatReceiptBuffer(data: ReceiptData): Uint8Array;

  /**
   * Send an ESC/POS drawer kick pulse to open the cash drawer.
   * @param pin Which connector pin to pulse (2 or 5, default 2)
   */
  openDrawer(pin?: 2 | 5): Promise<boolean>;
}

/**
 * Abstract base class that implements common functionality
 * for all printer types
 */
export abstract class AbstractPrinterService implements BasePrinterService {
  protected _isConnected: boolean = false;
  protected _connectionConfig: unknown = null;

  abstract connect(connectionConfig: unknown): Promise<boolean>;
  abstract printReceipt(data: ReceiptData): Promise<boolean>;
  abstract getStatus(): Promise<PrinterStatus>;

  /**
   * Open cash drawer via ESC/POS command.
   * Subclasses that support raw byte writing should override sendBytes.
   */
  async openDrawer(pin: 2 | 5 = 2): Promise<boolean> {
    if (!this._isConnected) return false;
    const cmd = pin === 5 ? ESC_POS_COMMANDS.DRAWER_KICK_PIN5 : ESC_POS_COMMANDS.DRAWER_KICK_PIN2;
    return this.sendBytes(new Uint8Array(cmd));
  }

  /**
   * Send raw bytes to the printer. Override in concrete implementations.
   */
  protected async sendBytes(_data: Uint8Array): Promise<boolean> {
    return false;
  }

  /**
   * Disconnect from the printer
   */
  async disconnect(): Promise<void> {
    this._isConnected = false;
    this._connectionConfig = null;
  }

  /**
   * Check if connected to printer
   */
  isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Format receipt data into ESC/POS command buffer
   * @param data Receipt data
   */
  formatReceiptBuffer(data: ReceiptData): Uint8Array {
    const cs = data.currencySymbol || '£';
    const config = receiptConfigService.getConfig();
    const divider = receiptConfigService.getDividerLine();
    const doubleDivider = receiptConfigService.getDoubleDividerLine();
    let commands: number[] = [];

    // Initialize printer
    commands.push(...ESC_POS_COMMANDS.INIT);

    // Center align for header
    commands.push(...ESC_POS_COMMANDS.ALIGN_CENTER);

    // Store name — from ReceiptConfigService
    commands.push(...ESC_POS_COMMANDS.BOLD_ON);
    commands.push(...ESC_POS_COMMANDS.DOUBLE_HEIGHT);
    commands.push(...stringToBytes(config.header.businessName));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...ESC_POS_COMMANDS.BOLD_OFF);
    commands.push(...ESC_POS_COMMANDS.NORMAL_SIZE);

    if (config.header.addressLine1) {
      commands.push(...stringToBytes(config.header.addressLine1));
      commands.push(...ESC_POS_COMMANDS.NEWLINE);
    }
    if (config.header.addressLine2) {
      commands.push(...stringToBytes(config.header.addressLine2));
      commands.push(...ESC_POS_COMMANDS.NEWLINE);
    }
    if (config.header.phone) {
      commands.push(...stringToBytes(`Tel: ${config.header.phone}`));
      commands.push(...ESC_POS_COMMANDS.NEWLINE);
    }
    if (config.header.taxId) {
      commands.push(...stringToBytes(`Tax ID: ${config.header.taxId}`));
      commands.push(...ESC_POS_COMMANDS.NEWLINE);
    }
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Divider line
    commands.push(...stringToBytes(divider));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Return to left alignment for details
    commands.push(...ESC_POS_COMMANDS.ALIGN_LEFT);

    // Order info
    commands.push(...stringToBytes(`Order #: ${data.orderId}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...stringToBytes(`Date: ${data.date.toLocaleString()}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...stringToBytes(`Cashier: ${data.cashierName}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    if (data.customerName) {
      commands.push(...stringToBytes(`Customer: ${data.customerName}`));
      commands.push(...ESC_POS_COMMANDS.NEWLINE);
    }

    // Divider line
    commands.push(...stringToBytes(divider));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Order items
    for (const item of data.items) {
      const itemTotal = item.quantity * item.price;
      if (item.quantity > 1) {
        commands.push(...stringToBytes(item.name));
        commands.push(...ESC_POS_COMMANDS.NEWLINE);
        commands.push(
          ...stringToBytes(
            receiptConfigService.formatLine(`  ${item.quantity} x ${cs}${item.price.toFixed(2)}`, `${cs}${itemTotal.toFixed(2)}`)
          )
        );
      } else {
        commands.push(...stringToBytes(receiptConfigService.formatLine(item.name, `${cs}${itemTotal.toFixed(2)}`)));
      }
      commands.push(...ESC_POS_COMMANDS.NEWLINE);
    }

    // Divider line
    commands.push(...stringToBytes(divider));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Align right for totals
    commands.push(...ESC_POS_COMMANDS.ALIGN_RIGHT);

    // Totals
    commands.push(...stringToBytes(`Subtotal: ${cs}${data.subtotal.toFixed(2)}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...stringToBytes(`Tax: ${cs}${data.tax.toFixed(2)}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Total — bold
    commands.push(...ESC_POS_COMMANDS.BOLD_ON);
    commands.push(...stringToBytes(doubleDivider));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...stringToBytes(`Total: ${cs}${data.total.toFixed(2)}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...ESC_POS_COMMANDS.BOLD_OFF);
    commands.push(...stringToBytes(doubleDivider));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Payment method — center aligned
    commands.push(...ESC_POS_COMMANDS.ALIGN_CENTER);
    commands.push(...stringToBytes(`Payment Method: ${data.paymentMethod}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE, ...ESC_POS_COMMANDS.NEWLINE);

    // Footer — from ReceiptConfigService
    if (config.footer.line1) {
      commands.push(...stringToBytes(config.footer.line1));
      commands.push(...ESC_POS_COMMANDS.NEWLINE);
    }
    if (config.footer.line2) {
      commands.push(...stringToBytes(config.footer.line2));
      commands.push(...ESC_POS_COMMANDS.NEWLINE);
    }
    if (config.footer.line3) {
      commands.push(...stringToBytes(config.footer.line3));
      commands.push(...ESC_POS_COMMANDS.NEWLINE);
    }
    commands.push(...ESC_POS_COMMANDS.NEWLINE, ...ESC_POS_COMMANDS.NEWLINE);

    // Cut receipt (if supported by model)
    if (config.options.cutPaper && config.printerModel.supportsCut) {
      commands.push(...ESC_POS_COMMANDS.CUT);
    }

    return new Uint8Array(commands);
  }
}
