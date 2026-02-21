import { UserRole } from '../repositories/UserRepository';

/**
 * Role-based access control for screens and tabs.
 *
 * Admin   – full access
 * Manager – everything except User Management
 * Cashier – Order, Scan, Search, Daily Orders, Printer, Payment Terminal
 */

type TabName = 'Order' | 'Scan' | 'Search' | 'Inventory' | 'More';
type MoreMenuItem = 'OrderHistory' | 'Settings' | 'Users' | 'Refund' | 'Printer' | 'PaymentTerminal' | 'SyncQueue' | 'Reports';

const TAB_ACCESS: Record<UserRole, TabName[]> = {
  admin: ['Order', 'Scan', 'Search', 'Inventory', 'More'],
  manager: ['Order', 'Scan', 'Search', 'Inventory', 'More'],
  cashier: ['Order', 'Scan', 'Search', 'More'],
};

const MORE_MENU_ACCESS: Record<UserRole, MoreMenuItem[]> = {
  admin: ['OrderHistory', 'Settings', 'Users', 'Refund', 'Printer', 'PaymentTerminal', 'SyncQueue', 'Reports'],
  manager: ['OrderHistory', 'Settings', 'Refund', 'Printer', 'PaymentTerminal', 'SyncQueue', 'Reports'],
  cashier: ['OrderHistory', 'Printer', 'PaymentTerminal'],
};

export const canAccessTab = (role: UserRole | undefined, tab: TabName): boolean => {
  if (!role) return true; // Fallback: allow access when role is unknown (dev mode)
  return TAB_ACCESS[role].includes(tab);
};

export const canAccessMoreMenuItem = (role: UserRole | undefined, item: MoreMenuItem): boolean => {
  if (!role) return true; // Fallback: allow access when role is unknown (dev mode)
  return MORE_MENU_ACCESS[role].includes(item);
};
