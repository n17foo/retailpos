import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import SettingsScreen from './SettingsScreen';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';

jest.mock('../../../shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isDesktop: true }),
}));

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k, getCurrentLanguage: () => 'en', changeLanguage: jest.fn() }),
}));

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: jest.fn(),
}));

jest.mock('../../platform-clients/hooks/useEcommerceSettings', () => ({
  useEcommerceSettings: () => ({ ecommerceSettings: { platform: 'shopify' } }),
}));

jest.mock('../../../shared/contexts/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#fff',
      textPrimary: '#000',
      textSecondary: '#666',
      border: '#ccc',
      primary: '#2196F3',
      hover: '#eee',
    },
  }),
}));

jest.mock('./GenericSettingsTab', () => {
  const R = require('react');
  return () => R.createElement('Text', null, 'MockGenericSettingsTab');
});

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('denies access to cashiers and renders settings tabs for admin/manager', async () => {
    (useAuthContext as jest.Mock).mockReturnValue({ user: { id: 'u1', role: 'cashier' } });
    const deniedTree = await renderUi(<SettingsScreen />);
    expect(hasText(deniedTree, 'Access denied. Settings require manager or admin role.')).toBe(true);

    (useAuthContext as jest.Mock).mockReturnValue({ user: { id: 'u2', role: 'admin' } });
    const adminTree = await renderUi(<SettingsScreen />);
    expect(hasText(adminTree, 'settings.title')).toBe(true);
    expect(hasText(adminTree, 'MockGenericSettingsTab')).toBe(true);
  });
});
