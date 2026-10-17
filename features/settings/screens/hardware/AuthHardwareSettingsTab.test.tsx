import React from 'react';
import { renderUi, hasText } from '../../../../tests/testUtils';
import { AuthHardwareSettingsTab } from './AuthHardwareSettingsTab';

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../../../../shared/contexts/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#fff',
      textPrimary: '#000',
      textSecondary: '#666',
      border: '#ccc',
      primary: '#2196F3',
      success: '#4CAF50',
    },
  }),
}));

jest.mock('../../../authentication/services/auth/CardReaderDetection', () => ({
  cardReaderDetection: {
    detectReaders: jest
      .fn()
      .mockResolvedValue([{ deviceId: 'r1', vendorName: 'MagTek', productName: 'SureSwipe', vendorId: 0x0801, productId: 0x0001 }]),
  },
}));

describe('AuthHardwareSettingsTab', () => {
  it('detects USB HID card readers and lists supported vendors', async () => {
    const tree = await renderUi(<AuthHardwareSettingsTab />);
    expect(hasText(tree, 'Card Reader Detection')).toBe(true);
    expect(hasText(tree, 'MagTek')).toBe(true);
    expect(hasText(tree, 'SureSwipe')).toBe(true);
  });
});
