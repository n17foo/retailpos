import React from 'react';
import { renderUi, hasText, pressByText } from '../../../../tests/testUtils';
import { CashDrawerSettingsTab } from './CashDrawerSettingsTab';
import { keyValueRepository } from '../../../../shared/repositories/KeyValueRepository';

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

jest.mock('../../../../shared/repositories/KeyValueRepository', () => ({
  keyValueRepository: {
    getObject: jest.fn().mockResolvedValue({ pin: 2, openOnCash: true }),
    setObject: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('CashDrawerSettingsTab', () => {
  it('loads drawer settings, switches RJ-11 pin to Pin 5, and saves', async () => {
    const tree = await renderUi(<CashDrawerSettingsTab />);
    expect(hasText(tree, 'Cash Drawer Configuration')).toBe(true);

    await pressByText(tree, 'Pin 5');
    await pressByText(tree, 'Save Settings');
    expect(keyValueRepository.setObject).toHaveBeenCalledWith('cashDrawerSettings', { pin: 5, openOnCash: true });
  });
});
