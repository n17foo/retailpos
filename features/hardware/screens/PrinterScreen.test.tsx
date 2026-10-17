import React from 'react';
import { Alert } from 'react-native';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import PrinterScreen from './PrinterScreen';

const mockConnectToPrinter = jest.fn().mockResolvedValue(true);
const mockPrintReceipt = jest.fn().mockResolvedValue(true);
const mockPrinterService = {
  getAvailablePrinters: () => [{ printerName: 'Epson TM-T88', ipAddress: '192.168.1.50', port: 9100, paperWidth: 80 }],
  isConnectedToPrinter: () => false,
  getActivePrinter: () => null,
  connectToPrinter: mockConnectToPrinter,
  printReceipt: mockPrintReceipt,
};

jest.mock('../services/printer/PrinterServiceFactory', () => ({
  PrinterServiceFactory: {
    getInstance: () => mockPrinterService,
  },
}));

jest.mock('../../platform-clients/services/config/POSConfigService', () => ({
  posConfig: { values: { taxRate: 0.2 } },
}));

jest.mock('../../basket/contexts/BasketStateProvider', () => ({
  useBasketState: () => ({
    basketItems: [{ id: '1', name: 'Espresso', quantity: 2, price: 3.5 }],
    total: 7,
  }),
}));

jest.mock('../../basket/contexts/BasketActionsProvider', () => ({
  useBasketActions: () => ({ clearBasket: jest.fn() }),
}));

describe('PrinterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists available printers, connects on tap, and prints receipt with cent-accurate tax', async () => {
    const tree = await renderUi(<PrinterScreen />);
    expect(hasText(tree, 'Epson TM-T88')).toBe(true);

    await pressByText(tree, 'Epson TM-T88');
    expect(mockConnectToPrinter).toHaveBeenCalledWith('Epson TM-T88');
    expect(Alert.alert).toHaveBeenCalledWith('Connected', expect.stringContaining('Epson TM-T88'));

    await pressByText(tree, 'Print Receipt (1 items)');
    expect(mockPrintReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: 7,
        tax: 1.4,
        total: 8.4,
      })
    );
  });
});
