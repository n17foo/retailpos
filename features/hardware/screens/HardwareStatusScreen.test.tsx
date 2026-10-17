import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { HardwareStatusScreen } from './HardwareStatusScreen';

jest.mock('../../../shared/contexts/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#fff',
      textPrimary: '#000',
      textSecondary: '#666',
      border: '#ccc',
      primary: '#2196F3',
      warning: '#FFC107',
      error: '#B00020',
      success: '#4CAF50',
      errorBackground: '#FFEBEE',
    },
  }),
}));

const mockRefresh = jest.fn().mockResolvedValue(undefined);
jest.mock('../hooks/useHardwareStatus', () => ({
  useHardwareStatus: () => ({
    status: {
      printer: { connected: true, status: 'ready', lastChecked: Date.now() },
      scanner: { connected: true, type: 'usb', lastChecked: Date.now() },
      drawer: { connected: true, isOpen: false, lastChecked: Date.now() },
      kds: { connected: false },
      display: { connected: false },
    },
    isPolling: true,
    lastError: null,
    refresh: mockRefresh,
  }),
}));

describe('HardwareStatusScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders status cards for all 5 hardware peripherals and triggers refresh / settings nav', async () => {
    const onNavigateToSettings = jest.fn();
    const tree = await renderUi(<HardwareStatusScreen onNavigateToSettings={onNavigateToSettings} />);
    expect(hasText(tree, 'Hardware Status')).toBe(true);
    expect(hasText(tree, 'Receipt Printer')).toBe(true);
    expect(hasText(tree, 'Barcode Scanner')).toBe(true);
    expect(hasText(tree, 'Cash Drawer')).toBe(true);

    await pressByText(tree, 'Refresh');
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    await pressByText(tree, 'Configure Printer');
    expect(onNavigateToSettings).toHaveBeenCalledWith('printer');
  });
});
