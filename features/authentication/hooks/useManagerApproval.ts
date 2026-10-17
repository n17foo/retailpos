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
import { managerApprovalService } from '../services/permissions/ManagerApprovalService';
import { permissionService } from '../services/permissions/PermissionService';
import { useAuthContext } from '../contexts/AuthProvider';

export function useManagerApproval() {
  const { user } = useAuthContext();
  const [isApproving, setIsApproving] = useState(false);

  /**
   * Request manager approval for an action.
   * First checks if the current user has permission — if yes, returns true immediately.
   * If no, triggers the manager approval modal.
   */
  const requestApproval = useCallback(
    async (actionKey: string): Promise<boolean> => {
      if (!user?.id) return false;

      setIsApproving(true);
      try {
        // Check if the current user already has permission
        const hasPermission = await permissionService.can(user.id, actionKey);
        if (hasPermission) {
          return true;
        }

        // User doesn't have permission — request manager approval
        const result = await managerApprovalService.requestApproval(actionKey, user.id);
        return result.approved;
      } finally {
        setIsApproving(false);
      }
    },
    [user?.id]
  );

  return { requestApproval, isApproving };
}
