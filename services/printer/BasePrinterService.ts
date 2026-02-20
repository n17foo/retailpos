import { ReceiptData, PrinterStatus } from './PrinterTypes';

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

// Helper function to convert string to byte array
export function stringToBytes(text: string): number[] {
  return Array.from(Buffer.from(text, 'utf8'));
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
  formatReceiptBuffer(data: ReceiptData): Buffer;

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
    return this.sendBytes(Buffer.from(cmd));
  }

  /**
   * Send raw bytes to the printer. Override in concrete implementations.
   */
  protected async sendBytes(_data: Buffer): Promise<boolean> {
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
  formatReceiptBuffer(data: ReceiptData): Buffer {
    const cs = data.currencySymbol || '£';
    let commands: number[] = [];

    // Initialize printer
    commands.push(...ESC_POS_COMMANDS.INIT);

    // Center align for header
    commands.push(...ESC_POS_COMMANDS.ALIGN_CENTER);

    // Store name header - bold and double height
    commands.push(...ESC_POS_COMMANDS.BOLD_ON);
    commands.push(...ESC_POS_COMMANDS.DOUBLE_HEIGHT);
    commands.push(...stringToBytes('RetailPOS'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...ESC_POS_COMMANDS.BOLD_OFF);
    commands.push(...ESC_POS_COMMANDS.NORMAL_SIZE);

    // Store address
    commands.push(...stringToBytes('123 Main Street'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...stringToBytes('Anytown, CA 94538'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...stringToBytes('Tel: (555) 123-4567'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE, ...ESC_POS_COMMANDS.NEWLINE);

    // Divider line
    commands.push(...stringToBytes('--------------------------------'));
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
    commands.push(...stringToBytes('--------------------------------'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Order items header
    commands.push(...stringToBytes('Item                 Qty    Price   Total'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...stringToBytes('--------------------------------'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Order items
    for (const item of data.items) {
      const itemTotal = item.quantity * item.price;

      // Format item name to fit within 20 chars
      let itemName = item.name.substring(0, 17);
      if (item.name.length > 17) {
        itemName += '...';
      }

      // Pad name, quantity, price, and total
      const line = `${itemName.padEnd(20)}${item.quantity.toString().padStart(3)} ${cs}${item.price.toFixed(2).padStart(7)} ${cs}${itemTotal.toFixed(2).padStart(7)}`;
      commands.push(...stringToBytes(line));
      commands.push(...ESC_POS_COMMANDS.NEWLINE);
    }

    // Divider line
    commands.push(...stringToBytes('--------------------------------'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Align right for totals
    commands.push(...ESC_POS_COMMANDS.ALIGN_RIGHT);

    // Totals
    commands.push(...stringToBytes(`Subtotal: ${cs}${data.subtotal.toFixed(2)}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...stringToBytes(`Tax: ${cs}${data.tax.toFixed(2)}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Total - bold
    commands.push(...ESC_POS_COMMANDS.BOLD_ON);
    commands.push(...stringToBytes(`Total: ${cs}${data.total.toFixed(2)}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...ESC_POS_COMMANDS.BOLD_OFF);

    // Divider line - center aligned
    commands.push(...ESC_POS_COMMANDS.ALIGN_CENTER);
    commands.push(...stringToBytes('================================'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);

    // Payment method
    commands.push(...stringToBytes(`Payment Method: ${data.paymentMethod}`));
    commands.push(...ESC_POS_COMMANDS.NEWLINE, ...ESC_POS_COMMANDS.NEWLINE);

    // Footer
    commands.push(...stringToBytes('Thank you for your purchase!'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE);
    commands.push(...stringToBytes('Please come again'));
    commands.push(...ESC_POS_COMMANDS.NEWLINE, ...ESC_POS_COMMANDS.NEWLINE);

    // Cut receipt
    commands.push(...ESC_POS_COMMANDS.CUT);

    return Buffer.from(commands);
  }
}
