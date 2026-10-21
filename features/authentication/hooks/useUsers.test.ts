import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useUsers } from './useUsers';
import { userRepository } from '../repositories/UserRepository';
import { permissionService } from '../services/permissions/PermissionService';
import { useAuthContext } from '../contexts/AuthProvider';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../repositories/UserRepository', () => {
  const repo = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updatePin: jest.fn(),
    delete: jest.fn(),
    deactivate: jest.fn(),
    activate: jest.fn(),
    findByPin: jest.fn(),
    isPinUnique: jest.fn(),
    hasAdminUser: jest.fn(),
  };
  return { userRepository: repo, getUserRepository: () => repo };
});

jest.mock('../services/permissions/PermissionService', () => ({
  permissionService: {
    can: jest.fn(),
    invalidateCache: jest.fn(),
  },
}));

jest.mock('../contexts/AuthProvider', () => ({
  useAuthContext: jest.fn(),
}));

const mockRepo = userRepository as jest.Mocked<typeof userRepository>;
const mockPerm = permissionService as jest.Mocked<typeof permissionService>;
const mockUseAuth = useAuthContext as jest.Mock;

async function mountHook() {
  let latest: ReturnType<typeof useUsers> | null = null;
  function Harness() {
    latest = useUsers();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.findAll.mockResolvedValue([
      { id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'admin', is_active: true, created_at: 1, updated_at: 1 },
    ]);
    mockUseAuth.mockReturnValue({ user: { id: 'u1', username: 'Alice', role: 'admin' } });
    mockPerm.can.mockResolvedValue(true);
  });

  it('loads users on mount', async () => {
    const { get } = await mountHook();
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    expect(get().users).toHaveLength(1);
    expect(get().users[0].name).toBe('Alice');
    expect(get().isLoading).toBe(false);
  });

  it('creates a user when authorized and PIN is unique', async () => {
    mockRepo.isPinUnique.mockResolvedValue(true);
    mockRepo.create.mockResolvedValue('u2');
    const { get } = await mountHook();

    let createdId = '';
    await act(async () => {
      createdId = await get().createUser({ name: 'Bob', pin: '123456', role: 'cashier' });
    });

    expect(createdId).toBe('u2');
    expect(mockRepo.create).toHaveBeenCalledWith({ name: 'Bob', pin: '123456', role: 'cashier' });
  });

  it('rejects createUser when PIN is not unique', async () => {
    mockRepo.isPinUnique.mockResolvedValue(false);
    const { get } = await mountHook();

    await act(async () => {
      await expect(get().createUser({ name: 'Bob', pin: '123456', role: 'cashier' })).rejects.toThrow(
        'PIN is already in use by another user'
      );
    });
    expect(get().error).toBe('PIN is already in use by another user');
  });

  it('validates PIN format before updating PIN', async () => {
    const { get } = await mountHook();

    let ok = true;
    await act(async () => {
      ok = await get().updatePin('u1', '123');
    });

    expect(ok).toBe(false);
    expect(get().error).toBe('PIN must be exactly 6 digits');
    expect(mockRepo.updatePin).not.toHaveBeenCalled();
  });

  it('deletes user and invalidates permission cache', async () => {
    const { get } = await mountHook();

    await act(async () => {
      await get().deleteUser('u2');
    });

    expect(mockRepo.delete).toHaveBeenCalledWith('u2');
    expect(mockPerm.invalidateCache).toHaveBeenCalledWith('u2');
  });
});
