import React from 'react';
import { renderUi, hasText } from '../../tests/testUtils';
import { RootNavigator } from './RootNavigator';
import { useAuthContext } from '../../features/authentication/contexts/AuthProvider';
import { useOnboardingContext } from '../../features/onboarding/contexts/OnboardingProvider';

jest.mock('../../shared/hooks/useLogger', () => ({
  useLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('../../shared/services/audit/AuditLogService', () => ({
  auditLogService: { log: jest.fn() },
}));

jest.mock('../../features/platform-clients/services/token/TokenUtils', () => ({
  warmUpPlatformToken: jest.fn().mockResolvedValue({ platform: null, acquired: false }),
}));

jest.mock('../../features/authentication/hooks/useInactivityLock', () => ({
  useInactivityLock: () => jest.fn(),
}));

jest.mock('../../features/authentication/contexts/AuthProvider', () => ({
  useAuthContext: jest.fn(),
}));

jest.mock('../../features/onboarding/contexts/OnboardingProvider', () => ({
  useOnboardingContext: jest.fn(),
}));

jest.mock('./AuthNavigator', () => ({
  AuthNavigator: () => {
    const R = require('react');
    return R.createElement('Text', null, 'MockAuthNavigator');
  },
}));

jest.mock('./MainTabNavigator', () => ({
  MainTabNavigator: () => {
    const R = require('react');
    return R.createElement('Text', null, 'MockMainTabNavigator');
  },
}));

describe('RootNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useOnboardingContext as jest.Mock).mockReturnValue({ isOnboarded: true });
  });

  it('renders AuthNavigator when unauthenticated and MainTabNavigator when authenticated', async () => {
    (useAuthContext as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      setIsAuthenticated: jest.fn(),
      user: null,
      setUser: jest.fn(),
    });
    const unauthTree = await renderUi(<RootNavigator />);
    expect(hasText(unauthTree, 'MockAuthNavigator')).toBe(true);

    (useAuthContext as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      setIsAuthenticated: jest.fn(),
      user: { id: 'u1', username: 'Admin', role: 'admin' },
      setUser: jest.fn(),
    });
    const authTree = await renderUi(<RootNavigator />);
    expect(hasText(authTree, 'MockMainTabNavigator')).toBe(true);
  });
});
