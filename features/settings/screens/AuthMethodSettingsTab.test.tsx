import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import AuthMethodSettingsTab from './AuthMethodSettingsTab';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../authentication/services/auth/AuthConfigService', () => ({
  authConfig: {
    authMode: 'offline',
    primaryMethod: 'pin',
    allowedMethods: ['pin'],
    setAllowedMethods: jest.fn(),
    setPrimaryMethod: jest.fn(),
  },
}));

jest.mock('../../authentication/services/auth/AuthService', () => ({
  authService: {
    getProvider: () => ({ isAvailable: jest.fn().mockResolvedValue(true) }),
  },
}));

describe('AuthMethodSettingsTab', () => {
  it('loads and displays available authentication methods for the active mode', async () => {
    const tree = await renderUi(<AuthMethodSettingsTab />);
    expect(hasText(tree, 'settings.auth.title')).toBe(true);
    expect(hasText(tree, '6-Digit PIN')).toBe(true);
  });
});
