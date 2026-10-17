/**
 * PermissionRepository
 *
 * SQLite persistence for custom permission sets, per-action overrides,
 * user-to-set assignments, and the manager approval log.
 *
 * Tables (created in dbSchema.ts v5 migration):
 *   permission_sets       — named permission profiles
 *   permission_overrides  — per-action overrides within a set
 *   user_permission_sets  — many-to-many: users ↔ sets
 *   approval_log          — audit trail of manager approval events
 */

import { db } from '../../../shared/utils/db';
import { generateUUID } from '../../../shared/utils/uuid';

// ── Row shapes ────────────────────────────────────────────────────────────

export interface PermissionSetRow {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface PermissionOverrideRow {
  id: string;
  permission_set_id: string;
  action_key: string;
  /** 1 = granted, 0 = denied */
  granted: number;
  created_at: number;
}

export interface UserPermissionSetRow {
  user_id: string;
  permission_set_id: string;
  assigned_at: number;
}

export interface ApprovalLogRow {
  id: string;
  action_key: string;
  requesting_user_id: string;
  approving_user_id: string;
  approved: number; // 1 = approved, 0 = denied/cancelled
  created_at: number;
}

// ── Domain types ──────────────────────────────────────────────────────────

export interface PermissionSet {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PermissionOverride {
  id: string;
  permissionSetId: string;
  actionKey: string;
  granted: boolean;
  createdAt: number;
}

// ── Repository ────────────────────────────────────────────────────────────

export class PermissionRepository {
  // ── Permission Sets ───────────────────────────────────────────────────

  async createSet(name: string, description: string | null, createdBy: string | null): Promise<string> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO permission_sets (id, name, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, description, createdBy, now, now]
    );
    return id;
  }

  async findAllSets(): Promise<PermissionSet[]> {
    const rows = await db.getAllAsync<PermissionSetRow>('SELECT * FROM permission_sets ORDER BY name ASC');
    return rows.map(this.mapSet);
  }

  async findSetById(id: string): Promise<PermissionSet | null> {
    const row = await db.getFirstAsync<PermissionSetRow>('SELECT * FROM permission_sets WHERE id = ?', [id]);
    return row ? this.mapSet(row) : null;
  }

  async updateSet(id: string, name: string, description: string | null): Promise<void> {
    const now = Date.now();
    await db.runAsync('UPDATE permission_sets SET name = ?, description = ?, updated_at = ? WHERE id = ?', [name, description, now, id]);
  }

  async deleteSet(id: string): Promise<void> {
    // Cascades to permission_overrides and user_permission_sets via FK
    await db.runAsync('DELETE FROM permission_sets WHERE id = ?', [id]);
  }

  async countUsersForSet(setId: string): Promise<number> {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_permission_sets WHERE permission_set_id = ?',
      [setId]
    );
    return result?.count ?? 0;
  }

  // ── Permission Overrides ──────────────────────────────────────────────

  async upsertOverride(permissionSetId: string, actionKey: string, granted: boolean): Promise<void> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO permission_overrides (id, permission_set_id, action_key, granted, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(permission_set_id, action_key)
       DO UPDATE SET granted = excluded.granted`,
      [id, permissionSetId, actionKey, granted ? 1 : 0, now]
    );
  }

  async deleteOverride(permissionSetId: string, actionKey: string): Promise<void> {
    await db.runAsync('DELETE FROM permission_overrides WHERE permission_set_id = ? AND action_key = ?', [permissionSetId, actionKey]);
  }

  async findOverridesForSet(permissionSetId: string): Promise<PermissionOverride[]> {
    const rows = await db.getAllAsync<PermissionOverrideRow>('SELECT * FROM permission_overrides WHERE permission_set_id = ?', [
      permissionSetId,
    ]);
    return rows.map(this.mapOverride);
  }

  async findOverridesForUser(userId: string): Promise<PermissionOverride[]> {
    const rows = await db.getAllAsync<PermissionOverrideRow>(
      `SELECT po.* FROM permission_overrides po
       JOIN user_permission_sets ups ON ups.permission_set_id = po.permission_set_id
       WHERE ups.user_id = ?`,
      [userId]
    );
    return rows.map(this.mapOverride);
  }

  // ── User ↔ Set Assignments ────────────────────────────────────────────

  async assignSetToUser(userId: string, permissionSetId: string): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `INSERT OR IGNORE INTO user_permission_sets (user_id, permission_set_id, assigned_at)
       VALUES (?, ?, ?)`,
      [userId, permissionSetId, now]
    );
  }

  async removeSetFromUser(userId: string, permissionSetId: string): Promise<void> {
    await db.runAsync('DELETE FROM user_permission_sets WHERE user_id = ? AND permission_set_id = ?', [userId, permissionSetId]);
  }

  async findSetsForUser(userId: string): Promise<PermissionSet[]> {
    const rows = await db.getAllAsync<PermissionSetRow>(
      `SELECT ps.* FROM permission_sets ps
       JOIN user_permission_sets ups ON ups.permission_set_id = ps.id
       WHERE ups.user_id = ?
       ORDER BY ps.name ASC`,
      [userId]
    );
    return rows.map(this.mapSet);
  }

  async findUsersForSet(permissionSetId: string): Promise<string[]> {
    const rows = await db.getAllAsync<{ user_id: string }>('SELECT user_id FROM user_permission_sets WHERE permission_set_id = ?', [
      permissionSetId,
    ]);
    return rows.map(r => r.user_id);
  }

  // ── Approval Log ──────────────────────────────────────────────────────

  async logApproval(actionKey: string, requestingUserId: string, approvingUserId: string, approved: boolean): Promise<void> {
    const id = generateUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO approval_log (id, action_key, requesting_user_id, approving_user_id, approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, actionKey, requestingUserId, approvingUserId, approved ? 1 : 0, now]
    );
  }

  async findApprovalsByUser(userId: string): Promise<ApprovalLogRow[]> {
    return db.getAllAsync<ApprovalLogRow>('SELECT * FROM approval_log WHERE requesting_user_id = ? ORDER BY created_at DESC', [userId]);
  }

  // ── Mappers ───────────────────────────────────────────────────────────

  private mapSet(row: PermissionSetRow): PermissionSet {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapOverride(row: PermissionOverrideRow): PermissionOverride {
    return {
      id: row.id,
      permissionSetId: row.permission_set_id,
      actionKey: row.action_key,
      granted: row.granted === 1,
      createdAt: row.created_at,
    };
  }
}

export const permissionRepository = new PermissionRepository();
