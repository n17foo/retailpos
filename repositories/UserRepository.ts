import { db } from '../utils/db';
import { generateUUID } from '../utils/uuid';
import { hashPin, isHashedPin, verifyPin } from '../utils/crypto';

export type UserRole = 'admin' | 'manager' | 'cashier';

export interface User {
  id: string;
  name: string;
  email?: string | null;
  pin: string; // 6-digit PIN, stored hashed
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
  ...row,
  is_active: row.is_active === 1,
});

export interface CreateUserInput {
  name: string;
  email?: string | null;
  pin: string;
  role: UserRole;
  platform_user_id?: string | null;
}

export class UserRepository {
  async create(user: CreateUserInput): Promise<string> {
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
    const users = await this.findActive();
    for (const user of users) {
      if (verifyPin(pin, user.pin)) {
        if (!isHashedPin(user.pin)) {
          // Transparent migration: re-hash legacy plaintext PIN on successful match
          await this.updatePin(user.id, pin).catch(() => undefined);
        }
        return user;
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
    const now = Date.now();
    const fields = Object.keys(data);
    const values = fields.map(key => {
      const value = data[key as keyof typeof data];
      // Convert boolean to integer for SQLite
      if (typeof value === 'boolean') return value ? 1 : 0;
      // Never store a plaintext PIN via the generic update path
      if (key === 'pin' && typeof value === 'string' && !isHashedPin(value)) return hashPin(value);
      return value;
    });

    const statement = `UPDATE users SET ${fields.map(field => `${field} = ?`).join(', ')}, updated_at = ? WHERE id = ?`;
    await db.runAsync(statement, [...values, now, id] as (string | number | boolean)[]);
  }

  async updatePin(id: string, newPin: string): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE users SET pin = ?, updated_at = ? WHERE id = ?', [hashPin(newPin), now, id]);
  }

  async deactivate(id: string): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?', [now, id]);
  }

  async activate(id: string): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?', [now, id]);
  }

  async delete(id: string): Promise<void> {
    await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
  }

  async isPinUnique(pin: string, excludeUserId?: string): Promise<boolean> {
    const users = await this.findAll();
    return !users.some(user => user.id !== excludeUserId && verifyPin(pin, user.pin));
  }

  async hasAdminUser(): Promise<boolean> {
    const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1', [
      'admin',
    ]);
    return (result?.count || 0) > 0;
  }
}

export const userRepository = new UserRepository();
