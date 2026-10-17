/**
 * menuCapabilityAccess
 *
 * Capability-based gating layer for More menu items and settings tabs.
 * Kept separate from roleAccess.ts so role logic and platform capability
 * logic remain independently testable and composable.
 *
 * Visibility rule (from onboarding-menu-capability-implementation.md §3.2):
 *   visible     = roleAllowed && capability !== 'not_recommended'
 *   interactive = visible && (capability === 'supported' || adapterReady)
 */

import { CapabilityLevel } from './platformCapabilities';

export type MenuItemStatus = 'enabled' | 'disabled' | 'hidden';

export interface CapabilityGateResult {
  status: MenuItemStatus;
  /** Populated when status is 'disabled' — shown as subtitle in the menu item */
  reason?: string;
}

/**
 * Evaluate whether a menu item or settings tab should be shown and in what state.
 *
 * @param capabilityLevel  The platform's capability level for this feature
 * @param adapterReady     Whether the custom adapter is configured and ready (for 'custom' features)
 * @param unavailableReason Human-readable reason string (from getUnavailableReason)
 */
export function evaluateCapabilityGate(
  capabilityLevel: CapabilityLevel,
  adapterReady: boolean,
  unavailableReason: string
): CapabilityGateResult {
  if (capabilityLevel === 'not_recommended') {
    return { status: 'hidden' };
  }

  if (capabilityLevel === 'supported') {
    return { status: 'enabled' };
  }

  // custom — show but gate on adapter readiness
  if (adapterReady) {
    return { status: 'enabled' };
  }

  return {
    status: 'disabled',
    reason: unavailableReason,
  };
}

/**
 * Determine the combined status for a menu item that requires both
 * role access AND capability access.
 *
 * If role denies access, the item is hidden regardless of capability.
 */
export function evaluateCombinedAccess(
  roleAllowed: boolean,
  capabilityLevel: CapabilityLevel,
  adapterReady: boolean,
  unavailableReason: string
): CapabilityGateResult {
  if (!roleAllowed) {
    return { status: 'hidden' };
  }
  return evaluateCapabilityGate(capabilityLevel, adapterReady, unavailableReason);
}

/**
 * Convenience: evaluate a feature that has no capability key (always enabled if role allows).
 */
export function evaluateRoleOnlyAccess(roleAllowed: boolean): CapabilityGateResult {
  return { status: roleAllowed ? 'enabled' : 'hidden' };
}
