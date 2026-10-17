import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import ReceiptSettingsTab from './ReceiptSettingsTab';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

const mockConfig = {
  printerModel: { type: 'epson' as const },
  header: { businessName: 'Store', addressLine1: '', addressLine2: '', phone: '', email: '', website: '', taxId: '', logoEnabled: false },
  footer: { line1: 'Thank you', line2: '', line3: '', showSocialMedia: false, facebook: '', instagram: '', twitter: '' },
  options: {
    paperWidth: 80 as const,
    showBarcode: true,
    showQrCode: false,
    qrCodeUrl: '',
    showTaxBreakdown: true,
    showCashierName: true,
    showOrderNumber: true,
    showDateTime: true,
    autoPrint: true,
    openCashDrawerOnCash: true,
    copies: 1,
  },
};

jest.mock('../../hardware/hooks/useReceiptConfig', () => ({
  useReceiptConfig: () => ({
    config: mockConfig,
    isLoading: false,
    error: null,
    updateHeader: jest.fn(),
    updateFooter: jest.fn(),
    updateOptions: jest.fn(),
    setPrinterModel: jest.fn(),
  }),
}));

describe('ReceiptSettingsTab', () => {
  it('renders printer models, paper widths, and receipt options', async () => {
    const tree = await renderUi(<ReceiptSettingsTab />);
    expect(hasText(tree, 'Epson')).toBe(true);
    expect(hasText(tree, '80mm')).toBe(true);
  });
});
