/**
 * Pure validation logic for printer settings.
 * Extracted from usePrinterSettings so it can be unit-tested without React or RN.
 */

export enum PrinterConnectionType {
  BLUETOOTH = 'bluetooth',
  NETWORK = 'network',
  USB = 'usb',
}

export interface PrinterSettingsInput {
  printerName?: string;
  connectionType: PrinterConnectionType | string;
  macAddress?: string;
  ipAddress?: string;
  port?: number;
  vendorId?: number;
  productId?: number;
}

export interface ValidationResult {
  isValid: boolean;
  /** i18n key under `locales/{lang}/common.json` — translate at the call site */
  error?: string;
}

export function validatePrinterSettings(settings: PrinterSettingsInput): ValidationResult {
  if (!settings.printerName?.trim()) {
    return { isValid: false, error: 'settings.printer.validation.printerNameRequired' };
  }

  switch (settings.connectionType) {
    case PrinterConnectionType.BLUETOOTH:
      if (!settings.macAddress?.match(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)) {
        return { isValid: false, error: 'settings.printer.validation.invalidMacAddress' };
      }
      break;

    case PrinterConnectionType.NETWORK:
      if (!settings.ipAddress?.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
        return { isValid: false, error: 'settings.printer.validation.invalidIpAddress' };
      }
      if (!settings.port || settings.port < 1 || settings.port > 65535) {
        return { isValid: false, error: 'settings.printer.validation.invalidPort' };
      }
      break;

    case PrinterConnectionType.USB:
      if (settings.vendorId === undefined || settings.productId === undefined) {
        return { isValid: false, error: 'settings.printer.validation.usbIdsRequired' };
      }
      break;
  }

  return { isValid: true };
}
