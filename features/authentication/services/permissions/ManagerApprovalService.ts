/**
 * ManagerApprovalService
 *
 * Orchestrates the in-context manager PIN challenge.
 * Returns a Promise that resolves when the modal is dismissed.
 *
 * Usage:
 *   const result = await managerApprovalService.requestApproval('price:override', cashierId);
 *   if (result.approved) { ... }
 *
 * The service holds a pending resolver that the ManagerApprovalModal
 * calls via resolve() when the manager authenticates or cancels.
 *
 * See: docs/specs/auth/permissions.md §2.2
 */

import { authService } from '../auth/AuthService';
import { permissionService } from './PermissionService';
import { permissionRepository } from '../../repositories/PermissionRepository';
import { auditLogService } from '../../../../shared/services/audit/AuditLogService';
import { notificationService } from '../../../../shared/services/notifications/NotificationService';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { ACTION_MAP } from '../../../../shared/utils/actionRegistry';

export interface ApprovalResult {
  approved: boolean;
  approvingUserId?: string;
}

export interface PendingApproval {
  actionKey: string;
  actionDescription: string;
  requestingUserId: string;
  resolve: (result: ApprovalResult) => void;
}

/** Brute-force lockout: max failures before a cooldown period */
const MAX_FAILURES = 5;
const LOCKOUT_MS = 60_000;

export class ManagerApprovalService {
  private static instance: ManagerApprovalService;
  private logger = LoggerFactory.getInstance().createLogger('ManagerApprovalService');

  /** Currently pending approval request — null when idle */
  private pending: PendingApproval | null = null;

  /** Failure counter per requesting user */
  private failureCounts = new Map<string, number>();
  private lockoutUntil = new Map<string, number>();

  private constructor() {}

  static getInstance(): ManagerApprovalService {
    if (!ManagerApprovalService.instance) {
      ManagerApprovalService.instance = new ManagerApprovalService();
    }
    return ManagerApprovalService.instance;
  }

  /**
   * Request manager approval for an action.
   * Resolves when the modal is dismissed (approved or cancelled).
   */
  requestApproval(actionKey: string, requestingUserId: string): Promise<ApprovalResult> {
    // Check lockout
    const lockedUntil = this.lockoutUntil.get(requestingUserId) ?? 0;
    if (Date.now() < lockedUntil) {
      return Promise.resolve({ approved: false });
    }

    const def = ACTION_MAP.get(actionKey);
    const actionDescription = def?.description ?? actionKey;

    return new Promise<ApprovalResult>(resolve => {
      this.pending = { actionKey, actionDescription, requestingUserId, resolve };
      // Notify listeners (React components subscribe via getPending())
      this.notifyListeners();
    });
  }

  /** Get the current pending approval (consumed by ManagerApprovalModal) */
  getPending(): PendingApproval | null {
    return this.pending;
  }

  /**
   * Called by ManagerApprovalModal when the manager submits their PIN.
   * Validates the PIN, checks the manager has permission, and resolves.
   */
  async submitManagerPin(pin: string): Promise<{ success: boolean; error?: string }> {
    if (!this.pending) return { success: false, error: 'No pending approval' };

    const { actionKey, requestingUserId, resolve } = this.pending;

    // Authenticate the manager
    const authResult = await authService.authenticate('pin', pin);
    if (!authResult.success || !authResult.user?.id) {
      this.recordFailure(requestingUserId);
      return { success: false, error: 'Incorrect PIN. Please try again.' };
    }

    const managerId = authResult.user.id;
    const managerRole = authResult.user.role;

    // Check the manager has permission for this action
    const hasPermission = await permissionService.can(managerId, actionKey);
    if (!hasPermission) {
      const def = ACTION_MAP.get(actionKey);
      const minRole = def?.defaultMinRole ?? 'admin';
      const msg = minRole === 'admin' ? 'This action requires admin approval.' : 'This manager does not have permission for this action.';
      return { success: false, error: msg };
    }

    // Log the approval
    await permissionRepository.logApproval(actionKey, requestingUserId, managerId, true);
    await auditLogService.log('permission:approved', {
      userId: managerId,
      details: `Manager approved '${actionKey}' for user ${requestingUserId}`,
      metadata: { actionKey, requestingUserId, approvingUserId: managerId, managerRole },
    });

    // Reset failure count
    this.failureCounts.delete(requestingUserId);

    // Resolve the promise and clear pending
    this.pending = null;
    this.notifyListeners();
    resolve({ approved: true, approvingUserId: managerId });

    return { success: true };
  }

  /** Called by ManagerApprovalModal when the cashier cancels */
  cancel(): void {
    if (!this.pending) return;
    const { resolve } = this.pending;
    this.pending = null;
    this.notifyListeners();
    resolve({ approved: false });
  }

  // ── Listener pattern for React components ────────────────────────────

  private listeners: Array<() => void> = [];

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l());
  }

  // ── Brute-force lockout ───────────────────────────────────────────────

  private recordFailure(requestingUserId: string): void {
    const count = (this.failureCounts.get(requestingUserId) ?? 0) + 1;
    this.failureCounts.set(requestingUserId, count);

    if (count >= MAX_FAILURES) {
      this.lockoutUntil.set(requestingUserId, Date.now() + LOCKOUT_MS);
      this.failureCounts.delete(requestingUserId);
      this.logger.warn(`Approval lockout triggered for user ${requestingUserId} after ${MAX_FAILURES} failures`);
      notificationService.notify('Approval Locked', `Too many failed approval attempts. Locked for 60 seconds.`, 'warning');
    }
  }
}

export const managerApprovalService = ManagerApprovalService.getInstance();
