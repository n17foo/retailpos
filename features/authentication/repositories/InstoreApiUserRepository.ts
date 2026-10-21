import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { isStoreApiUnavailable } from '../../multi-register/services/offline/isStoreApiUnavailable';
import { userRepository } from './UserRepository';
import { CreateUserInput, User, UserRepositoryInterface, UserRole } from './UserRepository';
import { validatePinFormat } from '../utils/userPin.utils';

const VALID_ROLES: readonly UserRole[] = ['admin', 'manager', 'cashier'];

function toUser(u: {
  id: string;
  name: string;
  email: string | null;
  role: string;
  platform_user_id?: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: VALID_ROLES.includes(u.role as UserRole) ? (u.role as UserRole) : 'cashier',
    platform_user_id: u.platform_user_id ?? null,
    is_active: u.is_active,
    created_at: u.created_at,
    updated_at: u.updated_at,
  };
}

function assertValidRole(role: unknown): asserts role is UserRole {
  if (!VALID_ROLES.includes(role as UserRole)) {
    throw new Error('Invalid user role');
  }
}

/**
 * Store-API-backed user repository — used in client mode so user identity,
 * PINs, roles and active state are shared store-wide. PIN verification and
 * uniqueness checks run server-side; hashes never reach the register.
 *
 * LAN outage behavior: every successful read upserts into the local users
 * table (PIN column preserved), and every successful server PIN verify caches
 * the credential on this register via hashPin. While the LAN is down, reads
 * and PIN login fall back to that cache — so a cashier who has logged in on
 * this till before can still sign in, and permissions resolve against the
 * last-known roles. A credential this till has never seen cannot verify
 * offline. Mutations and isPinUnique still require the server.
 */
export class InstoreApiUserRepository implements UserRepositoryInterface {
  async create(input: CreateUserInput): Promise<string> {
    const validation = validatePinFormat(input.pin);
    if (!validation.isValid) throw new Error(validation.error);
    assertValidRole(input.role);

    const user = await instoreApiClient.createUser({
      name: input.name,
      email: input.email,
      pin: input.pin,
      role: input.role,
      platform_user_id: input.platform_user_id,
    });
    // The creator just saw this credential — cache it so the new user can log
    // into THIS register while offline too.
    const mapped = toUser(user);
    await userRepository.cacheServerUser(mapped).catch(() => undefined);
    await userRepository.cacheVerifiedPin(user.id, input.pin).catch(() => undefined);
    return user.id;
  }

  async findById(id: string): Promise<User | null> {
    try {
      const user = await instoreApiClient.getUser(id);
      if (user) await userRepository.cacheServerUser(toUser(user)).catch(() => undefined);
      return user ? toUser(user) : null;
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      return userRepository.findById(id);
    }
  }

  async findByPin(pin: string): Promise<User | null> {
    if (!validatePinFormat(pin).isValid) return null;
    try {
      const user = await instoreApiClient.verifyPin(pin);
      // verify-pin returns only {id,name,role} — enough for an identity match
      if (!user) return null;
      const mapped = toUser({ ...user, email: null, platform_user_id: null, is_active: true, created_at: 0, updated_at: 0 });
      await userRepository.cacheServerUser(mapped).catch(() => undefined);
      // Cache the just-verified credential for offline login on this register.
      await userRepository.cacheVerifiedPin(user.id, pin).catch(() => undefined);
      return mapped;
    } catch (error) {
      if (!isStoreApiUnavailable(error)) return null;
      // LAN down — verify against credentials previously seen on this till.
      return userRepository.findByPin(pin);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const match = (await instoreApiClient.getUsers()).find(u => u.email === email);
      return match ? toUser(match) : null;
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      return userRepository.findByEmail(email);
    }
  }

  async findAll(): Promise<User[]> {
    try {
      const users = (await instoreApiClient.getUsers()).map(toUser);
      await Promise.all(users.map(u => userRepository.cacheServerUser(u).catch(() => undefined)));
      return users;
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      return userRepository.findAll();
    }
  }

  async findActive(): Promise<User[]> {
    return (await this.findAll()).filter(u => u.is_active);
  }

  async findAdmins(): Promise<User[]> {
    return (await this.findAll()).filter(u => u.is_active && u.role === 'admin');
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    if (data.role !== undefined) assertValidRole(data.role);
    await instoreApiClient.updateUser(id, {
      name: data.name,
      email: data.email,
      role: data.role,
      platform_user_id: data.platform_user_id,
      is_active: data.is_active,
    });
    const cached = await userRepository.findById(id).catch(() => null);
    if (cached) {
      await userRepository.cacheServerUser({ ...cached, ...data, id }).catch(() => undefined);
    }
  }

  async updatePin(id: string, newPin: string): Promise<void> {
    const validation = validatePinFormat(newPin);
    if (!validation.isValid) throw new Error(validation.error);
    await instoreApiClient.updateUser(id, { pin: newPin });
    // The user just entered the new PIN here — cache it for offline login.
    await userRepository.cacheVerifiedPin(id, newPin).catch(() => undefined);
  }

  async deactivate(id: string): Promise<void> {
    await instoreApiClient.updateUser(id, { is_active: false });
    const cached = await userRepository.findById(id).catch(() => null);
    if (cached) await userRepository.cacheServerUser({ ...cached, is_active: false }).catch(() => undefined);
  }

  async activate(id: string): Promise<void> {
    await instoreApiClient.updateUser(id, { is_active: true });
    const cached = await userRepository.findById(id).catch(() => null);
    if (cached) await userRepository.cacheServerUser({ ...cached, is_active: true }).catch(() => undefined);
  }

  async delete(id: string): Promise<void> {
    await instoreApiClient.deleteUser(id);
    // Drop the cached row — a deleted user must not be able to log in offline.
    const cached = await userRepository.findById(id).catch(() => null);
    if (cached) await userRepository.delete(id).catch(() => undefined);
  }

  /**
   * PIN uniqueness must be verified against the whole store — the local cache
   * is only the users this register has seen, so there is no safe offline
   * answer. Callers surface the error.
   */
  async isPinUnique(pin: string, excludeUserId?: string): Promise<boolean> {
    if (!validatePinFormat(pin).isValid) return false;
    return instoreApiClient.isPinUnique(pin, excludeUserId);
  }

  async hasAdminUser(): Promise<boolean> {
    try {
      return (await this.findAdmins()).length > 0;
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      return userRepository.hasAdminUser();
    }
  }
}
