import React from 'react';
import { renderUi, hasText } from '../../../../tests/testUtils';
import { PrinterSettingsTab } from './PrinterSettingsTab';

jest.mock('../../../../shared/contexts/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#000',
      textSecondary: '#666',
    },
  }),
}));

describe('PrinterSettingsTab', () => {
  it('renders Receipt Printer card', async () => {
    const tree = await renderUi(<PrinterSettingsTab />);
    expect(hasText(tree, 'Receipt Printer')).toBe(true);
  });
});
