import { AbstractPrinterService } from './BasePrinterService';
import { PrinterStatus, ReceiptData } from './PrinterTypes';
import { LoggerFactory } from '../logger/loggerFactory';

type PrinterConnectionType = 'network' | 'usb' | 'bluetooth';

/**
 * Mock implementation of UnifiedPrinterService for testing and development
 */
export class UnifiedPrinterServiceMock extends AbstractPrinterService {
  private printerType: PrinterConnectionType | null = null;
  private printQueue: string[] = [];
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('UnifiedPrinterServiceMock');
  }

  /**
   * Connect to a printer
   */
  async connect(config: any): Promise<boolean> {
    this.logger.info(`Connecting to ${config.connectionType} printer: ${config.printerName}`, { mock: true });

    this.printerType = config.connectionType;
    this._connectionConfig = config;
    this._isConnected = true;

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 500));

    this.logger.info(`Successfully connected to ${config.printerName}`, { mock: true });
    return true;
  }

  /**
   * Disconnect from the printer
   */
  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from printer', { mock: true });
    this._isConnected = false;
    this._connectionConfig = null;
    this.printQueue = [];
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * Print receipt data
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    if (!this.isConnected()) {
      this.logger.error({ message: 'Cannot print: Not connected to a printer', mock: true });
      return false;
    }

    this.logger.info(`Printing receipt for order #${data.orderId}`, { mock: true });
    this.logger.info(`Cashier: ${data.cashierName}`, { mock: true, receipt: true });

    if (data.customerName) {
      this.logger.info(`Customer: ${data.customerName}`, { mock: true, receipt: true });
    }

    this.logger.info(`Items (${data.items.length}):`, { mock: true, receipt: true });

    data.items.forEach(item => {
      const cs = data.currencySymbol || '£';
      this.logger.info(`Item: ${item.quantity}x ${item.name}: ${cs}${item.price.toFixed(2)}`, { mock: true, receipt: true, item });
    });

    const csMock = data.currencySymbol || '£';
    this.logger.info(`Subtotal: ${csMock}${data.subtotal.toFixed(2)}`, { mock: true, receipt: true });
    this.logger.info(`Tax: ${csMock}${data.tax.toFixed(2)}`, { mock: true, receipt: true });
    this.logger.info(`Total: ${csMock}${data.total.toFixed(2)}`, { mock: true, receipt: true });
    this.logger.info(`Payment: ${data.paymentMethod}`, { mock: true, receipt: true });

    if (data.notes) {
      this.logger.info(`Notes: ${data.notes}`, { mock: true, receipt: true });
    }

    this.logger.info('--- END OF RECEIPT ---', { mock: true, receipt: true });

    // Simulate printing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return true;
  }

  /**
   * Get printer status
   */
  async getStatus(): Promise<PrinterStatus> {
    return {
      isOnline: this.isConnected(),
      hasPaper: true,
    };
  }

  /**
   * Format receipt buffer (not used in mock)
   */
  formatReceiptBuffer(data: ReceiptData): Buffer {
    // In a real implementation, this would format the receipt data into a buffer
    return Buffer.from(JSON.stringify(data));
  }

  /**
   * Get the printer type
   */
  getPrinterType(): PrinterConnectionType | null {
    return this.printerType;
  }
}
