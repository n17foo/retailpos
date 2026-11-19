/**
 * useManagerApproval
 *
 * React hook for requesting manager approval for restricted actions.
 * Wraps ManagerApprovalService with permission checking.
 *
 * Usage:
 *   const { requestApproval, isApproving } = useManagerApproval();
 *   const approved = await requestApproval('price:override');
 *   if (approved) { ... }
 *
 * See: docs/specs/auth/permissions.md §2.2
 */

import { useState, useCallback } from 'react';
import { managerApprovalService, ApprovalResult } from '../services/permissions/ManagerApprovalService';
import { permissionService } from '../services/permissions/PermissionService';
import { useAuthContext } from '../contexts/AuthProvider';

export function useManagerApproval() {
  const { user } = useAuthContext();
  const [isApproving, setIsApproving] = useState(false);

  /**
   * Request manager approval for an action, returning the full result
   * including the approving manager's user id. Callers that re-verify
   * authorization downstream (e.g. exchange confirmation) need the approver
   * identity, not just the boolean.
   */
  const requestApprovalDetailed = useCallback(
    async (actionKey: string): Promise<ApprovalResult> => {
      if (!user?.id) return { approved: false };

      setIsApproving(true);
      try {
        // Check if the current user already has permission
        const hasPermission = await permissionService.can(user.id, actionKey);
        if (hasPermission) {
          return { approved: true };
        }

        // User doesn't have permission — request manager approval
        return await managerApprovalService.requestApproval(actionKey, user.id);
      } finally {
        setIsApproving(false);
      }
    },
    [user?.id]
  );

  /**
   * Request manager approval for an action.
   * First checks if the current user has permission — if yes, returns true immediately.
   * If no, triggers the manager approval modal.
   */
  const requestApproval = useCallback(
    async (actionKey: string): Promise<boolean> => {
      const result = await requestApprovalDetailed(actionKey);
      return result.approved;
    },
    [requestApprovalDetailed]
  );

  return { requestApproval, requestApprovalDetailed, isApproving };
}
