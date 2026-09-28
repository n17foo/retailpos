/**
 * PermissionService
 *
 * Single authoritative check for whether a user may perform a given action.
 *
 * Resolution order (highest priority first):
 *   1. Admin bypass — admin role always returns true
 *   2. User-level permission set overrides (granted / denied)
 *   3. Action registry default role requirement
 *   4. Deny (unknown action)
 *
 * See: docs/specs/auth/permissions.md §1, §6.1
 */

import type { UserRole } from '../../repositories/UserRepository';
import { userRepository } from '../../repositories/UserRepository';
import { permissionRepository } from '../../repositories/PermissionRepository';
import { ACTION_MAP, ROLE_RANK } from '../../utils/actionRegistry';
import { LoggerFactory } from '../logger/LoggerFactory';

export class PermissionService {
  private static instance: PermissionService;
  private logger = LoggerFactory.getInstance().createLogger('PermissionService');

  /**
   * In-memory cache: userId → Map<actionKey, decision>. Entries expire so role
   * changes or deactivations made elsewhere (e.g. on the server register)
   * take effect without an app restart.
   */
  private cache = new Map<string, Map<string, { allowed: boolean; expiresAt: number }>>();
  private static readonly CACHE_TTL_MS = 60_000;

  private constructor() {}

  static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  /**
   * Check whether a user may perform the given action.
   * Returns false on any error (fail-closed).
   */
  async can(userId: string, action: string): Promise<boolean> {
    try {
      // Check cache first
      const now = Date.now();
      const cached = this.cache.get(userId)?.get(action);
      if (cached && cached.expiresAt > now) return cached.allowed;

      const result = await this.resolve(userId, action);

      // Populate cache entry
      if (!this.cache.has(userId)) {
        this.cache.set(userId, new Map());
      }
      this.cache.get(userId)!.set(action, { allowed: result, expiresAt: now + PermissionService.CACHE_TTL_MS });

      return result;
    } catch (err) {
      this.logger.error(
        { message: `PermissionService.can(${userId}, ${action}) threw — defaulting to deny` },
        err instanceof Error ? err : new Error(String(err))
      );
      return false;
    }
  }

  /**
   * Synchronous role-only check — used by navigation composers where async
   * is not available. Does NOT consult custom permission set overrides.
   * Use can() for full resolution.
   */
  canByRole(role: UserRole | undefined, action: string): boolean {
    const effectiveRole: UserRole = role ?? 'cashier';
    if (effectiveRole === 'admin') return true;
    const def = ACTION_MAP.get(action);
    if (!def) return false;
    return ROLE_RANK[effectiveRole] >= ROLE_RANK[def.defaultMinRole];
  }

  /** Invalidate the cache for a specific user (call after role/set changes) */
  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }

  /** Invalidate the entire cache (call after bulk permission changes) */
  invalidateAll(): void {
    this.cache.clear();
  }

  // ── Private resolution ────────────────────────────────────────────────

  private async resolve(userId: string, action: string): Promise<boolean> {
    // 1. Load user role
    const user = await userRepository.findById(userId);
    // Deactivated staff retain no privileges, including admins.
    if (!user || !user.is_active) return false;

    // 2. Admin bypass
    if (user.role === 'admin') return true;

    // 3. Check permission set overrides. A user may belong to several sets;
    // an explicit deny in any set wins over a grant in another.
    const matching = (await permissionRepository.findOverridesForUser(userId)).filter(o => o.actionKey === action);
    if (matching.length > 0) {
      if (matching.some(o => !o.granted)) return false;
      // Enforce ceiling: cannot grant admin-only actions to non-admin
      const def = ACTION_MAP.get(action);
      if (def && def.defaultMinRole === 'admin') {
        this.logger.warn(`Override grants admin-only action '${action}' to non-admin user ${userId} — ceiling enforced`);
        return false;
      }
      return true;
    }

    // 4. Fall back to action registry default
    const def = ACTION_MAP.get(action);
    if (!def) {
      this.logger.warn(`Unknown action key '${action}' — defaulting to deny`);
      return false;
    }
    return ROLE_RANK[user.role] >= ROLE_RANK[def.defaultMinRole];
  }
}

export const permissionService = PermissionService.getInstance();
