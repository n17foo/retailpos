import React from 'react';
import { renderUi, hasText, pressByText } from '../../../../tests/testUtils';
import { ScannerSettingsTab } from './ScannerSettingsTab';
import { scannerSettingsService } from '../../../hardware/services/scanner/ScannerSettingsService';

jest.mock('../../../../shared/contexts/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#fff',
      textPrimary: '#000',
      textSecondary: '#666',
      textOnPrimary: '#fff',
      border: '#ccc',
      primary: '#2196F3',
    },
  }),
}));

jest.mock('../../../hardware/services/scanner/ScannerSettingsService', () => {
  const actual = jest.requireActual('../../../hardware/services/scanner/ScannerSettingsService');
  return {
    ...actual,
    scannerSettingsService: {
      initialize: jest.fn().mockResolvedValue(undefined),
      getSettings: jest.fn(() => ({
        bluetooth: {
          preset: 'microchip_rn4020',
          serviceUUID: '49535343-FE7D-4AE5-8FA9-9FAFD205E455',
          characteristicUUID: '49535343-8841-43F4-A8D4-ECBE34729BB3',
          deviceNamePatterns: ['scanner'],
        },
        usb: {
          scanIntervalMs: 80,
          minBarcodeLength: 3,
          maxBarcodeLength: 128,
          suffixChar: 'Enter',
        },
      })),
      updateSettings: jest.fn().mockResolvedValue(undefined),
    },
  };
});

describe('ScannerSettingsTab', () => {
  it('loads Bluetooth & USB scanner settings and saves updated suffix character', async () => {
    const tree = await renderUi(<ScannerSettingsTab />);
    expect(hasText(tree, 'Bluetooth Scanner')).toBe(true);
    expect(hasText(tree, 'USB Scanner')).toBe(true);

    await pressByText(tree, 'Tab');
    await pressByText(tree, 'Save Settings');
    expect(scannerSettingsService.updateSettings).toHaveBeenCalled();
  });
});
