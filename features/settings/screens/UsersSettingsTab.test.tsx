import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import UsersSettingsTab from './UsersSettingsTab';

const mockLoadUsers = jest.fn();
const mockUsers = [
  { id: 'u1', name: 'Alice Admin', email: 'alice@shop.com', role: 'admin' as const, is_active: true, created_at: 1, updated_at: 1 },
];

jest.mock('../../authentication/hooks/useUsers', () => ({
  useUsers: () => ({
    users: mockUsers,
    isLoading: false,
    error: null,
    loadUsers: mockLoadUsers,
    createUser: jest.fn(),
    updateUser: jest.fn(),
    updatePin: jest.fn(),
    deactivateUser: jest.fn(),
    activateUser: jest.fn(),
    isPinUnique: jest.fn().mockResolvedValue(true),
  }),
}));

describe('UsersSettingsTab', () => {
  it('lists staff users and opens Add User modal', async () => {
    const tree = await renderUi(<UsersSettingsTab />);
    expect(hasText(tree, 'Alice Admin')).toBe(true);

    await pressByText(tree, '+ Add User');
    expect(hasText(tree, 'Add New User')).toBe(true);
  });
});
