import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import PermissionSetsScreen from './PermissionSetsScreen';
import { permissionRepository } from '../../authentication/repositories/PermissionRepository';

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', role: 'admin' } }),
}));

jest.mock('../../../shared/services/audit/AuditLogService', () => ({
  auditLogService: { log: jest.fn() },
}));

jest.mock('../../authentication/services/permissions/PermissionService', () => ({
  permissionService: {
    can: jest.fn().mockResolvedValue(true),
    invalidateAll: jest.fn(),
  },
}));

jest.mock('../../authentication/repositories/PermissionRepository', () => ({
  permissionRepository: {
    findAllSets: jest.fn(),
    countUsersForSet: jest.fn(),
    findOverridesForSet: jest.fn(),
    createSet: jest.fn(),
    updateSet: jest.fn(),
    deleteSet: jest.fn(),
    upsertOverride: jest.fn(),
    deleteOverride: jest.fn(),
  },
}));

describe('PermissionSetsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (permissionRepository.findAllSets as jest.Mock).mockResolvedValue([
      { id: 'ps1', name: 'Senior Cashier', description: 'Can process refunds' },
    ]);
    (permissionRepository.countUsersForSet as jest.Mock).mockResolvedValue(2);
  });

  it('lists permission sets with user counts and opens New Permission Set form', async () => {
    const tree = await renderUi(<PermissionSetsScreen />);
    expect(hasText(tree, 'Senior Cashier')).toBe(true);

    await pressByText(tree, '+ New Set');
    expect(hasText(tree, 'New Permission Set')).toBe(true);
  });
});
