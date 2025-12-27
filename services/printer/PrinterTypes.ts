/**
 * Printer configuration interface
 */
export interface PrinterConfig {
  printerName: string;
  connectionType: 'network' | 'usb' | 'bluetooth';
  // Network specific properties
  ipAddress?: string;
  port?: number;
  // USB specific properties
  usbId?: string;
  vendorId?: number;
  productId?: number;
  // Bluetooth specific properties
  macAddress?: string;
  deviceName?: string;
  // Common properties
  paperWidth?: number; // mm
}

/**
 * Receipt item interface
 */
export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

/**
 * Receipt data interface
 */
export interface ReceiptData {
  orderId: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  date: Date;
  cashierName: string;
  customerName?: string;
  notes?: string;
}

/**
 * Printer status interface
 */
export interface PrinterStatus {
  isOnline: boolean;
  hasPaper: boolean;
  drawerOpen?: boolean;
  errorCode?: number;
  errorMessage?: string;
}

/**
 * Printer error types
 */
export enum PrinterErrorType {
  CONNECTION_ERROR = 'connection_error',
  PRINTER_BUSY = 'printer_busy',
  OUT_OF_PAPER = 'out_of_paper',
  HARDWARE_ERROR = 'hardware_error',
  UNKNOWN_ERROR = 'unknown_error',
}
