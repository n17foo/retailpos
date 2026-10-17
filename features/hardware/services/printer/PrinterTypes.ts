/**
 * Printer configuration interface
 */
export interface PrinterConfig {
  id?: string; // Unique identifier for the printer
  name?: string; // Display name for the printer
  printerName: string;
  connectionType: 'network' | 'usb' | 'bluetooth';
  type?: 'network' | 'usb' | 'bluetooth'; // Alias for connectionType
  model?: string; // Printer model (epson, star, citizen, generic)
  enabled?: boolean; // Whether the printer is enabled
  // Network specific properties
  host?: string; // Alias for ipAddress
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
 * Payment line for split tender receipts
 */
export interface ReceiptPaymentLine {
  method: string;
  amount: number;
  cardBrand?: string;
  last4?: string;
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
  /** Payment lines for split tender (optional) */
  paymentLines?: ReceiptPaymentLine[];
  date: Date;
  cashierName: string;
  customerName?: string;
  notes?: string;
  /** Fulfilment mode (pickup / delivery / …) — printed when set (spec 6.36) */
  saleMode?: string;
  currencySymbol?: string;
}

/**
 * Printer status interface
 */
export interface PrinterStatus {
  isOnline: boolean;
  hasPaper: boolean;
  paperLow?: boolean;
  paperOut?: boolean;
  offline?: boolean;
  error?: boolean;
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
