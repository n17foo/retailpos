import { db } from '../utils/db';
import { generateUUID } from '../utils/uuid';
import { hashPin, isHashedPin, verifyPin } from '../utils/crypto';
import { validatePinFormat } from '../utils/userPin.utils';
import { buildUpdateAssignments } from '../utils/sql';

export type UserRole = 'admin' | 'manager' | 'cashier';

export interface User {
  id: string;
  name: string;
  email?: string | null;
  role: UserRole;
  platform_user_id?: string | null; // Link to e-commerce platform user
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

// SQLite stores boolean as integer
interface UserRow {
  id: string;
  name: string;
  email: string | null;
  pin: string;
  role: UserRole;
  platform_user_id: string | null;
  is_active: number;
  created_at: number;
  updated_at: number;
}

const rowToUser = (row: UserRow): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  platform_user_id: row.platform_user_id,
  is_active: row.is_active === 1,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const USER_ROLES: readonly UserRole[] = ['admin', 'manager', 'cashier'];
const USER_UPDATE_COLUMNS = ['name', 'email', 'role', 'platform_user_id', 'is_active'] as const;

function assertValidRole(role: unknown): asserts role is UserRole {
  if (!USER_ROLES.includes(role as UserRole)) {
    throw new Error('Invalid user role');
  }
}

export interface CreateUserInput {
  name: string;
  email?: string | null;
  pin: string;
  role: UserRole;
  platform_user_id?: string | null;
}

export class UserRepository {
  async create(user: CreateUserInput): Promise<string> {
    const validation = validatePinFormat(user.pin);
    if (!validation.isValid) throw new Error(validation.error);
    assertValidRole(user.role);

    const now = Date.now();
    const id = generateUUID();

    await db.runAsync(
      `INSERT INTO users (id, name, email, pin, role, platform_user_id, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.name, user.email || null, hashPin(user.pin), user.role, user.platform_user_id || null, 1, now, now]
    );

    return id;
  }

  async findById(id: string): Promise<User | null> {
    const result = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    return result ? rowToUser(result) : null;
  }

  /**
   * Find the active user whose stored PIN matches `pin`.
   * PINs are stored salted+hashed, so each candidate row must be verified
   * individually (the users table is small — this is fine).
   * Legacy plaintext rows are transparently upgraded to a hash on match.
   */
  async findByPin(pin: string): Promise<User | null> {
    if (!validatePinFormat(pin).isValid) return null;

    const rows = await db.getAllAsync<UserRow>('SELECT * FROM users WHERE is_active = 1 ORDER BY name ASC');
    for (const row of rows) {
      if (verifyPin(pin, row.pin)) {
        if (!isHashedPin(row.pin)) {
          // Transparent migration: re-hash legacy plaintext PIN on successful match
          await this.updatePin(row.id, pin).catch(() => undefined);
        }
        return rowToUser(row);
      }
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
    return result ? rowToUser(result) : null;
  }

  async findAll(): Promise<User[]> {
    const results = await db.getAllAsync<UserRow>('SELECT * FROM users ORDER BY name ASC');
    return results.map(rowToUser);
  }

  async findActive(): Promise<User[]> {
    const results = await db.getAllAsync<UserRow>('SELECT * FROM users WHERE is_active = 1 ORDER BY name ASC');
    return results.map(rowToUser);
  }

  async findAdmins(): Promise<User[]> {
    const results = await db.getAllAsync<UserRow>('SELECT * FROM users WHERE role = ? AND is_active = 1 ORDER BY name ASC', ['admin']);
    return results.map(rowToUser);
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    if (data.role !== undefined) assertValidRole(data.role);
    const { assignments, values } = buildUpdateAssignments(data, USER_UPDATE_COLUMNS);
    if (assignments.length === 0) return;

    if ((data.role !== undefined && data.role !== 'admin') || data.is_active === false) {
      await this.assertNotLastActiveAdmin(id);
    }
    await db.runAsync(`UPDATE users SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`, [...values, Date.now(), id]);
  }

  async updatePin(id: string, newPin: string): Promise<void> {
    const validation = validatePinFormat(newPin);
    if (!validation.isValid) throw new Error(validation.error);

    const now = Date.now();
    await db.runAsync('UPDATE users SET pin = ?, updated_at = ? WHERE id = ?', [hashPin(newPin), now, id]);
  }

  async deactivate(id: string): Promise<void> {
    await this.assertNotLastActiveAdmin(id);
    const now = Date.now();
    await db.runAsync('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?', [now, id]);
  }

  async activate(id: string): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?', [now, id]);
  }

  async delete(id: string): Promise<void> {
    await this.assertNotLastActiveAdmin(id);
    await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
  }

  /** Prevent lock-out: the final active admin cannot be demoted, deactivated, or deleted. */
  private async assertNotLastActiveAdmin(id: string): Promise<void> {
    const target = await db.getFirstAsync<Pick<UserRow, 'role' | 'is_active'>>('SELECT role, is_active FROM users WHERE id = ?', [id]);
    if (target?.role !== 'admin' || target.is_active !== 1) return;
    const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1', [
      'admin',
    ]);
    if ((result?.count ?? 0) <= 1) {
      throw new Error('At least one active admin account is required');
    }
  }

  async isPinUnique(pin: string, excludeUserId?: string): Promise<boolean> {
    if (!validatePinFormat(pin).isValid) return false;
    const rows = await db.getAllAsync<UserRow>('SELECT * FROM users');
    return !rows.some(row => row.id !== excludeUserId && verifyPin(pin, row.pin));
  }

  async hasAdminUser(): Promise<boolean> {
    const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1', [
      'admin',
    ]);
    return (result?.count || 0) > 0;
  }
}

export const userRepository = new UserRepository();
