jest.mock('../logger/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: () => ({ createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }),
  },
}));
jest.mock('../../repositories/UserRepository', () => ({ userRepository: { findById: jest.fn() } }));
jest.mock('../../repositories/PermissionRepository', () => ({ permissionRepository: { findOverridesForUser: jest.fn() } }));

import { permissionService } from './PermissionService';
import { userRepository } from '../../repositories/UserRepository';
import { permissionRepository } from '../../repositories/PermissionRepository';

const findById = userRepository.findById as jest.Mock;
const findOverrides = permissionRepository.findOverridesForUser as jest.Mock;

function user(role: 'admin' | 'manager' | 'cashier', isActive = true) {
  return { id: 'u1', name: 'User', role, is_active: isActive, created_at: 1, updated_at: 1 };
}

describe('PermissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permissionService.invalidateAll();
    findOverrides.mockResolvedValue([]);
  });

  it('denies deactivated users, including admins', async () => {
    findById.mockResolvedValue(user('admin', false));
    await expect(permissionService.can('u1', 'settings:edit')).resolves.toBe(false);
  });

  it('lets an explicit deny win over a grant from another permission set', async () => {
    findById.mockResolvedValue(user('cashier'));
    findOverrides.mockResolvedValue([
      { id: 'a', permissionSetId: 's1', actionKey: 'refund:process', granted: true, createdAt: 1 },
      { id: 'b', permissionSetId: 's2', actionKey: 'refund:process', granted: false, createdAt: 1 },
    ]);
    await expect(permissionService.can('u1', 'refund:process')).resolves.toBe(false);
  });

  it('never grants admin-only actions to non-admins through overrides', async () => {
    findById.mockResolvedValue(user('manager'));
    findOverrides.mockResolvedValue([{ id: 'a', permissionSetId: 's1', actionKey: 'user:create', granted: true, createdAt: 1 }]);
    await expect(permissionService.can('u1', 'user:create')).resolves.toBe(false);
  });

  it('keeps settings:edit admin-only by default', () => {
    expect(permissionService.canByRole('manager', 'settings:edit')).toBe(false);
    expect(permissionService.canByRole(undefined, 'settings:view')).toBe(false);
    expect(permissionService.canByRole('admin', 'settings:edit')).toBe(true);
  });
});
