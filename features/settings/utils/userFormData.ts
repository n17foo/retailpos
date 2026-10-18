import { UserRole } from '../../authentication/hooks/useUsers';

export const PIN_LENGTH = 6;

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
];

export interface UserFormData {
  name: string;
  email: string;
  role: UserRole;
  platform_user_id: string;
}

export const EMPTY_USER_FORM: UserFormData = {
  name: '',
  email: '',
  role: 'cashier',
  platform_user_id: '',
};
