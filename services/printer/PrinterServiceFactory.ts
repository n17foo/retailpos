import { PrinterConfig, PrinterStatus, ReceiptData } from './PrinterTypes';
import { BasePrinterService } from './BasePrinterService';
import { USE_MOCK_PRINTERS } from '@env';
import { UnifiedPrinterServiceMock } from './UnifiedPrinterServiceMock';

// Define the connection type for the factory
type PrinterConnectionType = 'network' | 'usb' | 'bluetooth';

/**
 * Factory service that provides access to different printer types
 * This is the main entry point for printer functionality
 */
export class PrinterServiceFactory {
  private static instance: PrinterServiceFactory;

  // Available printers collection
  private availablePrinters: PrinterConfig[] = [
    {
      printerName: 'Epson TM-T20III',
      connectionType: 'network',
      ipAddress: '192.168.1.100',
      port: 9100,
      paperWidth: 80,
    },
    {
      printerName: 'Epson TM-T88VI',
      connectionType: 'network',
      ipAddress: '192.168.1.101',
      port: 9100,
      paperWidth: 80,
    },
    {
      printerName: 'Epson TM-m30',
      connectionType: 'usb',
      usbId: 'USB001',
      vendorId: 0x04b8, // Epson vendor ID
      productId: 0x0202, // Example product ID
      paperWidth: 80,
    },
    {
      printerName: 'Epson TM-P20',
      connectionType: 'bluetooth',
      macAddress: '00:11:22:33:44:55',
      deviceName: 'TM-P20 Printer',
      paperWidth: 58,
    },
  ];

  // Single unified printer service instance for all printer types
  private unifiedPrinterService: BasePrinterService;

  // Currently active printer service and config
  private activePrinterService: BasePrinterService | null = null;
  private activePrinterConfig: PrinterConfig | null = null;

  private constructor() {
    // The printer service will be initialized in getInstance()
    // to allow for dynamic loading of the mock or real implementation
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PrinterServiceFactory {
    if (!PrinterServiceFactory.instance) {
      console.log('[PrinterService] Initializing printer service factory');
      console.log('USE_MOCK_PRINTERS', USE_MOCK_PRINTERS);
      // Create the instance
      const instance = new PrinterServiceFactory();

      try {
        // Initialize the appropriate printer service based on environment
        if (USE_MOCK_PRINTERS === 'true') {
          console.log('[PrinterService] Using mock printer service');
          instance.unifiedPrinterService = new UnifiedPrinterServiceMock();
        } else {
          console.warn('[PrinterService] Failed to initialize real printer service, falling back to mock');
          const { UnifiedPrinterService } = require('./UnifiedPrinterService');
          instance.unifiedPrinterService = new UnifiedPrinterService();
        }

        // Store the instance only if initialization was successful
        PrinterServiceFactory.instance = instance;
      } catch (error) {
        console.error('[PrinterService] Critical error initializing printer service:', error);
        throw new Error('Failed to initialize printer service: ' + error.message);
      }
    }

    return PrinterServiceFactory.instance;
  }

  /**
   * Get list of available printers
   */
  public getAvailablePrinters(): PrinterConfig[] {
    return this.availablePrinters;
  }

  /**
   * Get currently active printer configuration
   */
  public getActivePrinter(): PrinterConfig | null {
    return this.activePrinterConfig;
  }

  /**
   * Check if connected to any printer
   */
  public isConnectedToPrinter(): boolean {
    return this.activePrinterService?.isConnected() || false;
  }

  /**
   * Connect to a printer by name
   * @param printerName Name of the printer to connect to
   */
  public async connectToPrinter(printerName: string): Promise<boolean> {
    try {
      console.log(`Connecting to printer: ${printerName}`);

      // Find printer in available printers
      const printer = this.availablePrinters.find(p => p.printerName === printerName);

      if (!printer) {
        throw new Error(`Printer "${printerName}" not found`);
      }

      // Disconnect from any active printer first
      await this.disconnect();

      // Use the unified printer service for all printer types
      const printerService = this.unifiedPrinterService;

      // Map the PrinterConfig to the format expected by UnifiedPrinterService
      const unifiedConfig = {
        printerName: printer.printerName,
        printerType: this.mapConnectionTypeToPrinterType(printer.connectionType),
        paperWidth: printer.paperWidth,
        // Add specific properties based on connection type
        ...(printer.connectionType === 'usb'
          ? {
              vendorId: printer.vendorId?.toString(16) || '',
              productId: printer.productId?.toString(16) || '',
            }
          : {}),
        ...(printer.connectionType === 'bluetooth'
          ? {
              deviceId: printer.macAddress || '',
              macAddress: printer.macAddress || '',
            }
          : {}),
        ...(printer.connectionType === 'network'
          ? {
              host: printer.ipAddress || '',
              port: printer.port || 9100,
            }
          : {}),
      };

      // Connect to the printer
      const connected = await printerService.connect(unifiedConfig);

      if (connected) {
        this.activePrinterService = printerService;
        this.activePrinterConfig = printer;
        console.log(`Connected to printer: ${printerName}`);
      } else {
        throw new Error(`Failed to connect to printer: ${printerName}`);
      }

      return connected;
    } catch (error) {
      console.error('Error connecting to printer:', error);
      this.activePrinterService = null;
      this.activePrinterConfig = null;
      return false;
    }
  }

  /**
   * Map connection type from PrinterConfig to PrinterConnectionType for UnifiedPrinterService
   */
  private mapConnectionTypeToPrinterType(connectionType: string): PrinterConnectionType {
    switch (connectionType) {
      case 'usb':
        return 'usb';
      case 'bluetooth':
        return 'bluetooth';
      case 'network':
        return 'network';
      default:
        throw new Error(`Unsupported connection type: ${connectionType}`);
    }
  }

  /**
   * Add or update a printer configuration
   * @param printerName Name of the printer to update
   * @param config Printer configuration
   */
  public updatePrinterConfig(printerName: string, config: PrinterConfig): void {
    // Find if the printer already exists in the available printers list
    const existingIndex = this.availablePrinters.findIndex(p => p.printerName === printerName);

    if (existingIndex >= 0) {
      // Update existing printer
      this.availablePrinters[existingIndex] = {
        ...this.availablePrinters[existingIndex],
        ...config,
      };
      console.log(`Updated configuration for printer: ${printerName}`);
    } else {
      // Add new printer
      this.availablePrinters.push(config);
      console.log(`Added new printer configuration: ${printerName}`);
    }

    // Update active printer config if this is the active printer
    if (this.activePrinterConfig?.printerName === printerName) {
      this.activePrinterConfig = {
        ...this.activePrinterConfig,
        ...config,
      };
    }
  }

  /**
   * Print a receipt on the active printer
   * @param data Receipt data to print
   */
  public async printReceipt(data: ReceiptData): Promise<boolean> {
    if (!this.activePrinterService) {
      throw new Error('Not connected to a printer');
    }

    try {
      console.log(`Printing receipt for order ${data.orderId}`);
      return await this.activePrinterService.printReceipt(data);
    } catch (error) {
      console.error('Failed to print receipt:', error);
      return false;
    }
  }

  /**
   * Get status of the active printer
   */
  public async getPrinterStatus(): Promise<PrinterStatus> {
    if (!this.activePrinterService) {
      return {
        isOnline: false,
        hasPaper: false,
        errorMessage: 'No printer connected',
      };
    }

    try {
      return await this.activePrinterService.getStatus();
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
   * Discover printers on the network
   * In a real implementation, this would use network discovery protocols
   */
  public async discoverPrinters(): Promise<PrinterConfig[]> {
    // This is where you would implement printer discovery
    // - For network printers: SNMP, mDNS, or vendor discovery protocols
    // - For USB printers: USB device enumeration
    // - For Bluetooth printers: Bluetooth device scanning

    // For this example, we're just returning the predefined printers
    return this.availablePrinters;
  }

  /**
   * Disconnect from the active printer
   */
  public async disconnect(): Promise<void> {
    if (this.activePrinterService) {
      await this.activePrinterService.disconnect();
      this.activePrinterService = null;
      this.activePrinterConfig = null;
    }
  }
}
