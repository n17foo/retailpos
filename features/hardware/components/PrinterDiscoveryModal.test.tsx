import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { PrinterDiscoveryModal } from './PrinterDiscoveryModal';
import { mobilePrinterDiscovery } from '../services/printer/MobilePrinterDiscovery';

jest.mock('../../../shared/contexts/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#fff',
      textPrimary: '#000',
      textSecondary: '#666',
      border: '#ccc',
      primary: '#2196F3',
    },
  }),
}));

jest.mock('../services/printer/MobilePrinterDiscovery', () => ({
  mobilePrinterDiscovery: {
    discover: jest.fn(),
    addManualPrinter: jest.fn(),
    testConnection: jest.fn(),
  },
}));

describe('PrinterDiscoveryModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('discovers network printers and calls onSelectPrinter when selected', async () => {
    const discoveredPrinter = {
      id: 'p1',
      printerName: 'Star TSP100',
      name: 'Star TSP100',
      host: '192.168.1.99',
      port: 9100,
      model: 'star',
    };
    (mobilePrinterDiscovery.discover as jest.Mock).mockResolvedValue([discoveredPrinter]);
    const onSelectPrinter = jest.fn();
    const onClose = jest.fn();

    const tree = await renderUi(<PrinterDiscoveryModal visible onClose={onClose} onSelectPrinter={onSelectPrinter} />);
    expect(hasText(tree, 'Discover Printers')).toBe(true);

    await pressByText(tree, 'Start Discovery');
    expect(hasText(tree, 'Star TSP100')).toBe(true);

    await pressByText(tree, 'Select');
    expect(onSelectPrinter).toHaveBeenCalledWith(discoveredPrinter);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
