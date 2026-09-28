jest.mock('../utils/db', () => ({
  db: {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    runAsync: jest.fn(),
  },
}));

jest.mock('../utils/uuid', () => ({ generateUUID: () => 'user-id' }));

import { db } from '../utils/db';
import { hashPin } from '../utils/crypto';
import { UserRepository } from './UserRepository';

const row = {
  id: 'user-1',
  name: 'Cashier',
  email: null,
  pin: hashPin('123456'),
  role: 'cashier' as const,
  platform_user_id: null,
  is_active: 1,
  created_at: 1,
  updated_at: 1,
};

describe('UserRepository credential isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not return PIN hashes from public user reads', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([row]);

    const users = await new UserRepository().findAll();

    expect(users).toEqual([
      {
        id: 'user-1',
        name: 'Cashier',
        email: null,
        role: 'cashier',
        platform_user_id: null,
        is_active: true,
        created_at: 1,
        updated_at: 1,
      },
    ]);
    expect(users[0]).not.toHaveProperty('pin');
  });

  it('still verifies against internal credential rows without exposing the hash', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([row]);

    const user = await new UserRepository().findByPin('123456');

    expect(user?.id).toBe('user-1');
    expect(user).not.toHaveProperty('pin');
  });
});

describe('UserRepository update hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects columns outside the update allowlist', async () => {
    const hostile = { 'pin = (SELECT pin FROM users LIMIT 1), name': 'x' } as unknown as { name: string };

    await expect(new UserRepository().update('user-1', hostile)).rejects.toThrow('cannot be updated');
    await expect(new UserRepository().update('user-1', { pin: '000000' } as unknown as { name: string })).rejects.toThrow(
      'cannot be updated'
    );
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('rejects unknown roles', async () => {
    await expect(new UserRepository().update('user-1', { role: 'superuser' as unknown as 'admin' })).rejects.toThrow('Invalid user role');
  });

  it('refuses to demote, deactivate, or delete the last active admin', async () => {
    (db.getFirstAsync as jest.Mock).mockImplementation(async (sql: string) =>
      sql.includes('COUNT') ? { count: 1 } : { role: 'admin', is_active: 1 }
    );
    const repository = new UserRepository();

    await expect(repository.update('admin-1', { role: 'manager' })).rejects.toThrow('active admin');
    await expect(repository.deactivate('admin-1')).rejects.toThrow('active admin');
    await expect(repository.delete('admin-1')).rejects.toThrow('active admin');
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('allows removing an admin when another active admin exists', async () => {
    (db.getFirstAsync as jest.Mock).mockImplementation(async (sql: string) =>
      sql.includes('COUNT') ? { count: 2 } : { role: 'admin', is_active: 1 }
    );

    await new UserRepository().deactivate('admin-1');

    expect(db.runAsync).toHaveBeenCalled();
  });
});
