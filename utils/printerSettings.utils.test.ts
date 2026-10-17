/**
 * printerSettings.utils — unit tests
 *
 * Tests all validation rules for Bluetooth, Network, and USB printer settings.
 */

import { validatePrinterSettings, PrinterConnectionType } from './printerSettings.utils';

// ── Shared helpers ────────────────────────────────────────────────────────

const base = {
  printerName: 'My Printer',
  connectionType: PrinterConnectionType.BLUETOOTH,
  macAddress: 'AA:BB:CC:DD:EE:FF',
};

// ── Printer name ──────────────────────────────────────────────────────────

describe('validatePrinterSettings — printer name', () => {
  it('fails when printerName is empty', () => {
    const result = validatePrinterSettings({ ...base, printerName: '' });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('settings.printer.validation.printerNameRequired');
  });

  it('fails when printerName is only whitespace', () => {
    const result = validatePrinterSettings({ ...base, printerName: '   ' });
    expect(result.isValid).toBe(false);
  });

  it('fails when printerName is undefined', () => {
    const result = validatePrinterSettings({ ...base, printerName: undefined });
    expect(result.isValid).toBe(false);
  });

  it('passes with a valid printer name', () => {
    const result = validatePrinterSettings(base);
    expect(result.isValid).toBe(true);
  });
});

// ── Bluetooth ─────────────────────────────────────────────────────────────

describe('validatePrinterSettings — Bluetooth', () => {
  const bt = { ...base, connectionType: PrinterConnectionType.BLUETOOTH };

  it('passes with a valid colon-separated MAC address', () => {
    expect(validatePrinterSettings({ ...bt, macAddress: 'AA:BB:CC:DD:EE:FF' }).isValid).toBe(true);
  });

  it('passes with a valid hyphen-separated MAC address', () => {
    expect(validatePrinterSettings({ ...bt, macAddress: 'AA-BB-CC-DD-EE-FF' }).isValid).toBe(true);
  });

  it('passes with lowercase hex digits', () => {
    expect(validatePrinterSettings({ ...bt, macAddress: 'aa:bb:cc:dd:ee:ff' }).isValid).toBe(true);
  });

  it('fails with a MAC address that is too short', () => {
    const result = validatePrinterSettings({ ...bt, macAddress: 'AA:BB:CC:DD:EE' });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('settings.printer.validation.invalidMacAddress');
  });

  it('fails with a MAC address that has invalid characters', () => {
    expect(validatePrinterSettings({ ...bt, macAddress: 'ZZ:BB:CC:DD:EE:FF' }).isValid).toBe(false);
  });

  it('fails with an empty MAC address', () => {
    expect(validatePrinterSettings({ ...bt, macAddress: '' }).isValid).toBe(false);
  });

  it('fails with undefined MAC address', () => {
    expect(validatePrinterSettings({ ...bt, macAddress: undefined }).isValid).toBe(false);
  });
});

// ── Network ───────────────────────────────────────────────────────────────

describe('validatePrinterSettings — Network', () => {
  const net = {
    printerName: 'Net Printer',
    connectionType: PrinterConnectionType.NETWORK,
    ipAddress: '192.168.1.100',
    port: 9100,
  };

  it('passes with a valid IP and port', () => {
    expect(validatePrinterSettings(net).isValid).toBe(true);
  });

  it('fails with an invalid IP address', () => {
    const result = validatePrinterSettings({ ...net, ipAddress: 'not-an-ip' });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('settings.printer.validation.invalidIpAddress');
  });

  it('fails with an empty IP address', () => {
    expect(validatePrinterSettings({ ...net, ipAddress: '' }).isValid).toBe(false);
  });

  it('fails with undefined IP address', () => {
    expect(validatePrinterSettings({ ...net, ipAddress: undefined }).isValid).toBe(false);
  });

  it('fails when port is 0', () => {
    const result = validatePrinterSettings({ ...net, port: 0 });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('settings.printer.validation.invalidPort');
  });

  it('fails when port exceeds 65535', () => {
    expect(validatePrinterSettings({ ...net, port: 65536 }).isValid).toBe(false);
  });

  it('passes with port at boundary value 1', () => {
    expect(validatePrinterSettings({ ...net, port: 1 }).isValid).toBe(true);
  });

  it('passes with port at boundary value 65535', () => {
    expect(validatePrinterSettings({ ...net, port: 65535 }).isValid).toBe(true);
  });

  it('fails when port is undefined', () => {
    expect(validatePrinterSettings({ ...net, port: undefined }).isValid).toBe(false);
  });
});

// ── USB ───────────────────────────────────────────────────────────────────

describe('validatePrinterSettings — USB', () => {
  const usb = {
    printerName: 'USB Printer',
    connectionType: PrinterConnectionType.USB,
    vendorId: 0x04b8,
    productId: 0x0202,
  };

  it('passes with valid vendorId and productId', () => {
    expect(validatePrinterSettings(usb).isValid).toBe(true);
  });

  it('fails when vendorId is undefined', () => {
    const result = validatePrinterSettings({ ...usb, vendorId: undefined });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('settings.printer.validation.usbIdsRequired');
  });

  it('fails when productId is undefined', () => {
    const result = validatePrinterSettings({ ...usb, productId: undefined });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('settings.printer.validation.usbIdsRequired');
  });

  it('fails when both vendorId and productId are undefined', () => {
    expect(validatePrinterSettings({ ...usb, vendorId: undefined, productId: undefined }).isValid).toBe(false);
  });

  it('passes when vendorId is 0 (valid USB ID)', () => {
    // 0 is a valid numeric ID — only undefined should fail
    expect(validatePrinterSettings({ ...usb, vendorId: 0 }).isValid).toBe(true);
  });
});
