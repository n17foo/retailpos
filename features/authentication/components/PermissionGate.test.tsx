import React from 'react';
import { Text } from 'react-native';
import { renderUi, hasText } from '../../../tests/testUtils';
import { PermissionGate } from './PermissionGate';
import { useAuthContext } from '../contexts/AuthProvider';
import { permissionService } from '../services/permissions/PermissionService';

jest.mock('../contexts/AuthProvider', () => ({
  useAuthContext: jest.fn(),
}));

jest.mock('../../../shared/contexts/ThemeProvider', () => ({
  useTheme: () => ({
    colors: { primary: '#2196F3', background: '#fff', textSecondary: '#666' },
  }),
}));

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../services/permissions/PermissionService', () => ({
  permissionService: {
    can: jest.fn(),
  },
}));

describe('PermissionGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders access denied when user lacks permission and children when allowed', async () => {
    (useAuthContext as jest.Mock).mockReturnValue({ user: { id: 'u1', role: 'cashier' } });
    (permissionService.can as jest.Mock).mockResolvedValueOnce(false);

    const deniedTree = await renderUi(
      <PermissionGate action="settings:view">
        <Text>Protected Settings</Text>
      </PermissionGate>
    );
    expect(hasText(deniedTree, 'common.accessDenied')).toBe(true);
    expect(hasText(deniedTree, 'Protected Settings')).toBe(false);

    (permissionService.can as jest.Mock).mockResolvedValueOnce(true);
    const allowedTree = await renderUi(
      <PermissionGate action="settings:view">
        <Text>Protected Settings</Text>
      </PermissionGate>
    );
    expect(hasText(allowedTree, 'Protected Settings')).toBe(true);
  });
});
