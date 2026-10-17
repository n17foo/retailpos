import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import ThemeSettingsTab from './ThemeSettingsTab';

const mockSetTheme = jest.fn();
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
    themeId: 'classic',
    setTheme: mockSetTheme,
  }),
}));

describe('ThemeSettingsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all theme presets and calls setTheme when a preset is tapped', async () => {
    const tree = await renderUi(<ThemeSettingsTab />);
    expect(hasText(tree, 'Choose a theme')).toBe(true);
    expect(hasText(tree, 'Ocean')).toBe(true);

    await pressByText(tree, 'Ocean');
    expect(mockSetTheme).toHaveBeenCalledWith('ocean');
  });
});
