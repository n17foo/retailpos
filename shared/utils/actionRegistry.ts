/**
 * actionRegistry
 *
 * Single source of truth for every sensitive action in the POS.
 * Each action has a default minimum role — the lowest role that can
 * perform it without a custom permission override or manager approval.
 *
 * Used by PermissionService to resolve whether a user can perform an action.
 * See: docs/specs/auth/permissions.md §Action Registry
 */

import type { UserRole } from '../../features/authentication/repositories/UserRepository';

export interface ActionDefinition {
  /** Dot-namespaced action key */
  key: string;
  /** Human-readable description shown in approval modals and permission set editor */
  description: string;
  /** Minimum role required by default */
  defaultMinRole: UserRole;
}

export const ACTION_REGISTRY: readonly ActionDefinition[] = [
  { key: 'discount:apply', description: 'Apply a discount code to the basket', defaultMinRole: 'cashier' },
  { key: 'discount:manual', description: 'Apply a manual/custom discount amount', defaultMinRole: 'manager' },
  { key: 'refund:process', description: 'Process a refund or return', defaultMinRole: 'manager' },
  { key: 'order:void', description: 'Void an unpaid order', defaultMinRole: 'manager' },
  { key: 'order:reopen', description: 'Reopen a completed order for exchange', defaultMinRole: 'manager' },
  { key: 'order:high_value', description: 'Complete a high-value transaction', defaultMinRole: 'manager' },
  { key: 'inventory:adjust', description: 'Manually adjust stock levels', defaultMinRole: 'manager' },
  { key: 'inventory:count', description: 'Start or finalise an inventory count', defaultMinRole: 'manager' },
  { key: 'price:override', description: 'Override the price of a basket item', defaultMinRole: 'manager' },
  { key: 'customer:edit', description: 'Edit a customer profile', defaultMinRole: 'manager' },
  { key: 'loyalty:adjust', description: 'Manually adjust loyalty points', defaultMinRole: 'manager' },
  { key: 'store_credit:issue', description: 'Issue store credit to a customer', defaultMinRole: 'manager' },
  { key: 'cash_drawer:open', description: 'Open the cash drawer outside of a sale', defaultMinRole: 'cashier' },
  { key: 'report:view', description: 'View daily/period reports', defaultMinRole: 'manager' },
  { key: 'report:export', description: 'Export report data', defaultMinRole: 'manager' },
  { key: 'settings:view', description: 'Access the Settings screen', defaultMinRole: 'manager' },
  { key: 'settings:edit', description: 'Save changes in Settings', defaultMinRole: 'admin' },
  { key: 'user:create', description: 'Create a new user', defaultMinRole: 'admin' },
  { key: 'user:edit', description: 'Edit an existing user', defaultMinRole: 'admin' },
  { key: 'user:delete', description: 'Delete a user', defaultMinRole: 'admin' },
  { key: 'purchase_order:create', description: 'Create a purchase order', defaultMinRole: 'manager' },
  { key: 'purchase_order:receive', description: 'Receive goods against a purchase order', defaultMinRole: 'manager' },
  { key: 'exchange:process', description: 'Process an exchange', defaultMinRole: 'manager' },
  { key: 'sync:retry', description: 'Manually retry a failed sync', defaultMinRole: 'manager' },
] as const;

/** Lookup map for O(1) access by key */
export const ACTION_MAP = new Map<string, ActionDefinition>(ACTION_REGISTRY.map(a => [a.key, a]));

/** Numeric rank for role comparison */
export const ROLE_RANK: Record<UserRole, number> = {
  admin: 3,
  manager: 2,
  cashier: 1,
};
