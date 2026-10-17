import { UserRole } from '../../features/authentication/repositories/UserRepository';

/**
 * Role-based access control for screens and tabs.
 *
 * Admin   – full access
 * Manager – everything except User Management
 * Cashier – Order, Scan, Search, Daily Orders, Printer, Payment Terminal
 */

type TabName = 'Sale' | 'Inventory' | 'More';
type MoreMenuItem =
  | 'OrderHistory'
  | 'Settings'
  | 'Users'
  | 'Refund'
  | 'Printer'
  | 'PaymentTerminal'
  | 'SyncQueue'
  | 'Reports'
  | 'Exchange'
  | 'Customers'
  | 'Procurement';

const TAB_ACCESS: Record<UserRole, TabName[]> = {
  admin: ['Sale', 'Inventory', 'More'],
  manager: ['Sale', 'Inventory', 'More'],
  cashier: ['Sale', 'More'],
};

const MORE_MENU_ACCESS: Record<UserRole, MoreMenuItem[]> = {
  admin: [
    'OrderHistory',
    'Settings',
    'Users',
    'Refund',
    'Exchange',
    'Printer',
    'PaymentTerminal',
    'SyncQueue',
    'Reports',
    'Customers',
    'Procurement',
  ],
  manager: [
    'OrderHistory',
    'Settings',
    'Refund',
    'Exchange',
    'Printer',
    'PaymentTerminal',
    'SyncQueue',
    'Reports',
    'Customers',
    'Procurement',
  ],
  cashier: ['OrderHistory', 'Printer', 'PaymentTerminal'],
};

export const canAccessTab = (role: UserRole | undefined, tab: TabName): boolean => {
  const effectiveRole: UserRole = role ?? 'cashier'; // Default to least-privilege role
  return TAB_ACCESS[effectiveRole].includes(tab);
};

export const canAccessMoreMenuItem = (role: UserRole | undefined, item: MoreMenuItem): boolean => {
  const effectiveRole: UserRole = role ?? 'cashier'; // Default to least-privilege role
  return MORE_MENU_ACCESS[effectiveRole].includes(item);
};
