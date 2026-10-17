import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import LoginScreen from './LoginScreen';
import { authService } from '../services/auth/AuthService';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../../shared/services/audit/AuditLogService', () => ({
  auditLogService: { log: jest.fn() },
}));

jest.mock('../services/auth/AuthConfigService', () => ({
  authConfig: { primaryMethod: 'pin' },
}));

jest.mock('../services/auth/AuthService', () => ({
  authService: {
    getAvailableProviders: jest.fn(),
    authenticate: jest.fn(),
  },
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authService.getAvailableProviders as jest.Mock).mockResolvedValue([
      { type: 'pin', info: { label: 'PIN', icon: '🔢' } },
      { type: 'password', info: { label: 'Password', icon: '🔑' } },
    ]);
  });

  it('renders PIN login UI, authenticates 6-digit PIN, and calls onLogin', async () => {
    const user = { id: 'u1', name: 'Alice', role: 'admin', is_active: true, created_at: 1, updated_at: 1 };
    (authService.authenticate as jest.Mock).mockResolvedValue({ success: true, user });
    const onLogin = jest.fn();

    const tree = await renderUi(<LoginScreen onLogin={onLogin} />);
    expect(hasText(tree, 'login.enterPin')).toBe(true);

    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      await pressByText(tree, digit);
    }

    expect(authService.authenticate).toHaveBeenCalledWith('pin', '123456');
    expect(onLogin).toHaveBeenCalledWith(user);
  });

  it('switches to password method and shows error on failure', async () => {
    (authService.authenticate as jest.Mock).mockResolvedValue({ success: false, error: 'Invalid credentials' });
    const tree = await renderUi(<LoginScreen onLogin={jest.fn()} />);

    await pressByText(tree, 'Password');
    expect(hasText(tree, 'login.enterPassword')).toBe(true);
  });
});
