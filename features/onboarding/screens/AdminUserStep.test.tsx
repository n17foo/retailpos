import React from 'react';
import { Alert } from 'react-native';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import AdminUserStep from './AdminUserStep';

const mockCreateUser = jest.fn().mockResolvedValue('admin-1');
const mockIsPinUnique = jest.fn().mockResolvedValue(true);
const mockValidatePin = jest.fn().mockResolvedValue(null);

jest.mock('../../authentication/hooks/useUsers', () => ({
  useUsers: () => ({
    createUser: mockCreateUser,
    isPinUnique: mockIsPinUnique,
    validatePin: mockValidatePin,
    isLoading: false,
  }),
}));

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe('AdminUserStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires admin name before advancing to PIN step', async () => {
    const tree = await renderUi(<AdminUserStep onBack={jest.fn()} onComplete={jest.fn()} />);
    expect(hasText(tree, 'adminUser.title')).toBe(true);

    await pressByText(tree, 'adminUser.setPin');
    expect(Alert.alert).toHaveBeenCalled();
  });
});
