import React from 'react';
import { renderUi, hasText, pressByText } from '../../tests/testUtils';
import { MoreNavigator } from './MoreNavigator';

jest.mock('../../features/platform-clients/hooks/useEcommerceSettings', () => ({
  useEcommerceSettings: () => ({ ecommerceSettings: { platform: 'shopify' } }),
}));

jest.mock('../../features/onboarding/services/SetupProgressService', () => ({
  setupProgressService: { hasDeferredSetup: () => true },
}));

jest.mock('../../shared/contexts/ThemeProvider', () => ({
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
    },
    preset: { name: 'Light', swatch: ['#fff', '#2196F3'] },
  }),
}));

describe('MoreNavigator', () => {
  it('renders MoreMenuScreen with deferred setup banner, theme banner, and Logout action', async () => {
    const onLogout = jest.fn();
    const tree = await renderUi(<MoreNavigator userRole="admin" onLogout={onLogout} />);
    expect(hasText(tree, 'More Options')).toBe(true);
    expect(hasText(tree, 'Finish setup — some features need configuration')).toBe(true);
    expect(hasText(tree, 'Settings')).toBe(true);
    await pressByText(tree, 'Logout');
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
