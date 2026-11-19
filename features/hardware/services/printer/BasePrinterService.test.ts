/**
 * HARD-01 regression — the shared receipt buffer (Electron + generic ESC/POS
 * paths) must emit the fiscal artifacts just like the native printer path:
 * fiscalNumber as the legal document reference and the QR command bytes for
 * fiscalQr.
 */
jest.mock('./ReceiptConfigService', () => ({
  receiptConfigService: {
    getConfig: jest.fn(() => ({
      header: { businessName: 'Test Store', addressLine1: '', addressLine2: '', phone: '', taxId: '' },
      footer: { line1: 'Thank you!', line2: '', line3: '' },
      options: { cutPaper: false },
      printerModel: { type: 'epson', characterWidth: 48, supportsCut: true },
    })),
    getDividerLine: jest.fn(() => '--------------------------------'),
    getDoubleDividerLine: jest.fn(() => '================================'),
    formatLine: jest.fn((label: string, value: string) => `${label} ${value}`),
  },
}));

import { AbstractPrinterService } from './BasePrinterService';
import { ReceiptData, PrinterStatus } from './PrinterTypes';

class TestPrinter extends AbstractPrinterService {
  async connect(): Promise<boolean> {
    return true;
  }
  async printReceipt(): Promise<boolean> {
    return true;
  }
  async getStatus(): Promise<PrinterStatus> {
    return { isOnline: true, hasPaper: true };
  }
}

const bufferText = (buf: Uint8Array): string => new TextDecoder().decode(buf);

const receipt = (overrides: Partial<ReceiptData> = {}): ReceiptData => ({
  orderId: 'order-uuid-1234',
  date: new Date('2026-01-15T12:00:00Z'),
  cashierName: 'Alice',
  items: [{ name: 'Widget', quantity: 1, price: 10 }],
  subtotal: 10,
  tax: 2,
  total: 12,
  paymentMethod: 'card',
  currencySymbol: '€',
  ...overrides,
});

describe('HARD-01 — fiscal artifacts in the shared receipt buffer', () => {
  const printer = new TestPrinter();

  it('prints the fiscal invoice number instead of the internal order id', () => {
    const buf = printer.formatReceiptBuffer(receipt({ fiscalNumber: 'A-2026-000042' }));
    const text = bufferText(buf);
    expect(text).toContain('A-2026-000042');
    expect(text).not.toContain('order-uuid-1234');
  });

  it('emits the QR command carrying the fiscal QR payload', () => {
    const url = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=X&numserie=A-1';
    const buf = printer.formatReceiptBuffer(receipt({ fiscalQr: url }));
    // The ESC/POS QR function embeds the payload bytes — assert the URL
    // itself is present in the byte stream, plus the GS ( k print marker.
    expect(bufferText(buf)).toContain(url);
    expect(Array.from(buf)).toContain(0x1d); // GS byte of the QR command sequence
  });

  it('falls back to the order id and emits no QR when unfiscalized', () => {
    const buf = printer.formatReceiptBuffer(receipt());
    const text = bufferText(buf);
    expect(text).toContain('order-uuid-1234');
    expect(text).not.toContain('ValidarQR');
  });
});
