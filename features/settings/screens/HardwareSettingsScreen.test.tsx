import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { HardwareSettingsScreen } from './HardwareSettingsScreen';

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

jest.mock('./hardware/ScannerSettingsTab', () => ({
  ScannerSettingsTab: () => {
    const R = require('react');
    return R.createElement('Text', null, 'MockScannerSettingsTab');
  },
}));

jest.mock('./hardware/PrinterSettingsTab', () => ({
  PrinterSettingsTab: () => {
    const R = require('react');
    return R.createElement('Text', null, 'MockPrinterSettingsTab');
  },
}));

describe('HardwareSettingsScreen', () => {
  it('renders hardware sub-tabs and switches active tab on tap', async () => {
    const tree = await renderUi(<HardwareSettingsScreen />);
    expect(hasText(tree, 'Hardware Settings')).toBe(true);
    expect(hasText(tree, 'MockScannerSettingsTab')).toBe(true);

    await pressByText(tree, 'Receipt Printer');
    expect(hasText(tree, 'MockPrinterSettingsTab')).toBe(true);
  });
});
